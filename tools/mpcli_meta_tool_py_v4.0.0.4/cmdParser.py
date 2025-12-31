from flashFileParser import *
from mp_base_def import *
from version import *
from argParserAgent import ArgParserAgent
from mp_setting import *


class CommandParser(object):
    def __init__(self, config=None):
        self.argParser = None
        self._config = config
        self.accessMode = None
        self._argAgent = ArgParserAgent(self._config)

        self.args = None
        self.cfg_info_dict = {
            CFG_DICT_E.SERIAL_INFO: {
                UART_ITEM_E.NAME: "",
                UART_ITEM_E.OPEN_BAUDRATE: CONFIG_UART_BAUDRATE_115200,
                UART_ITEM_E.MODIFY_BAUDRATE: 0},
            CFG_DICT_E.JSON_INFO: []
        }
        self.is_flash_action = False
        self.slot = ''
        # self.org_modify_bytes = ""
        self.exist_evt_flag = False
        # self.org_modify_mem_bytes = ""
        # self.org_modify_efuse_bytes = ""

        # self.modify_mem_bytes = None
        self.json_file_parser = FlashFileParser(self._config).getParser()
    def getArgs(self):
        return self.args

    def getConfig(self):
        return self._config

    def getCfgInfoDict(self):
        return self.cfg_info_dict

    def get_slot(self):
        return self.slot

    def is_flash_operation(self):
        if self.is_flash_action:
            return True

        if self.args == None:
            return False
        if self.args.all or self.args.erase or \
                self.args.program_flag or \
                (self.args.is_chip_erase != None and self.args.is_chip_erase == True):
            self.is_flash_action = True
            return True
        else:
            return False
    # def is_read_mem(self):
    #     return self.args.read_mem
    # def is_write_mem(self):
    #     return True if self.args.write_mem is not None else False
    # def is_read_efuse(self):
    #     return self.args.read_efuse
    # def is_write_efuse(self):
    #     return self.args.write_efuse

    def is_reboot(self):
        return self.args.reboot

    def is_exit_mp_loader(self):
        if "exit_mp_loader" in self.args:
            return True if self.args.exit_mp_loader != -1 else False
        else:
            return False

    def is_download(self):
        if self.args.all or self.args.program_flag:
            return True
        else:
            return False

    def is_erase(self):
        return self.args.erase

    def is_chip_erase(self):
        return self.args.is_chip_erase if self.args.is_chip_erase is not None else False

    def is_read(self):
        return self.args.savebin

    def is_unlock_protection(self):
        return self.args.unlock_protected

    def is_disable_merge(self):
        return self.args.disable_merge

    def is_dbg_passwd(self):
        if self.args.password is not None:
            return True
        else:
            return False

    # def is_modify(self):
    #     return True if self.args.modify_bytes is not None else False

    def get_modify_bytes(self):
        return self.org_modify_bytes

    def createArgParser(self):
        self.argParser = self._argAgent.create_arg_parser()
        if self.argParser == None:
            return ERR_CREATE_ARGS

        return ERR_OK

    def determineMode(self, args):
        if args.mode is not None:
            try:
                self.accessMode = T_MODE(int(args.mode))
            except ValueError as err:
                LOG_ERR("Error: don't support M {}".format(args.mode))
                return ERR_UNSUPPORTED_MODE
        elif args.ignore_load_rp:
            self.accessMode = T_MODE.FLASH_PATCH_MODE
        else:
            LOG_WARNING("warn: don't specify -M!")
            return ERR_MISS_M_FLAG

        return ERR_OK

    def parserCmd(self):
        self.args = self.argParser.parse_args()
        return self._parseArgs(self.args)

    def getAccessMode(self):
        return self.accessMode

    def setAccessMode(self,mode):
        self.accessMode = mode

    def _parseArgs(self, args):
        modeRet = self.determineMode(args)
        if (modeRet != ERR_OK) and \
           (modeRet != ERR_MISS_M_FLAG):
            return modeRet

        if args.comport == None and args.config_file == None:
            LOG_ERR("Error: missing com port through -c or -f.")
            return ERR_MISS_COM_INFO

        # flash program
        if args.config_file != None:
            # due to action='append',
            # -f config_1.json -f config_2.json -->  [['config_1.json'], ['config_2.json']]
            # -f config_1.json config_2.json    -->  [['config_1.json', 'config_2.json']]
            flash_file_parser = self.json_file_parser
            for config_file_group in args.config_file:
                for json_file in config_file_group:
                    cfg_info = flash_file_parser.parseJson(json_file)
                    if len(cfg_info[CFG_DICT_E.JSON_INFO]) == 0:
                        LOG_ERR("Error: fail to parser json file %s" % json_file)
                        return ERR_JSON_PARSE
                    else:
                        self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                            UART_ITEM_E.NAME] = \
                            cfg_info[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME]
                        self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                            UART_ITEM_E.MODIFY_BAUDRATE] = \
                            cfg_info[CFG_DICT_E.SERIAL_INFO][
                                UART_ITEM_E.MODIFY_BAUDRATE]

                        self.cfg_info_dict[CFG_DICT_E.JSON_INFO] += cfg_info[
                            CFG_DICT_E.JSON_INFO]
        # serial property
        if args.comport is not None:
            self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.NAME] = args.comport

        if args.modify_baudrate is not None:
            self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.MODIFY_BAUDRATE] = args.modify_baudrate
        else:
            if self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_115200:
                self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE] = \
                    max(self._config.CONFIG_SERIAL_DEFAULT_MODIFY_BAUDRATE,\
                        self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE])

        if args.open_baudrate is not None:
            self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.OPEN_BAUDRATE] = args.open_baudrate
        else:
            self.cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.OPEN_BAUDRATE] = self._config.CONFIG_SERIAL_DEFAULT_OPEN_BAUDRATE

        if args.address is not None:
            args.address = int(args.address, 16)
            args.address = self._argAgent.reset_flash_address(args.address)

        if args.flash_size is not None:
            if args.flash_size[0:2] == "0x" or args.flash_size[0:2] == "0X":
                args.flash_size = int(args.flash_size, 16)
            else:
                args.flash_size = int(args.flash_size)

        # flash program operation
        if args.program_flag:
            if args.address is None:
                LOG_ERR("Error: missing command arguments -A address for -p!")
                return ERR_MISS_ADDRESS_INFO
            else:
                args.address = self._argAgent.reset_flash_address(args.address)
            if args.bin_file is None:
                LOG_ERR("Error: missing command arguments -F image_path for -p!")
                return ERR_MISS_FILE_INFO
            self.cfg_info_dict[CFG_DICT_E.JSON_INFO] = [(args.address, args.bin_file)]

        # if args.packed_image is not None:
        #     config_param = []
        #     if self.json_file_parser.parsePackedFile(args.packed_image,
        #                                                      config_param) != 0:
        #         LOG_ERR("Error: parsing unpacked image %s fail." % args.packed_image)
        #         return ERR_PACKED_IMG_FMT
        #     self.cfg_info_dict[CFG_DICT_E.JSON_INFO] = config_param

        # if args.savebin:
        #     if args.address is None or \
        #             args.flash_size is None or \
        #             args.bin_file is None:
        #         LOG_ERR("Error: -s should be used with -A/-S/-F.")
        #         return ERR_MISS_SAVE_FILE_ARGS

        if args.erase:
            if args.address is None or \
                    args.flash_size is None:
                LOG_ERR("Error: -e should be used with -A/-S.")
                return ERR_MISS_ERASE_ARGS

        # if args.modify_bytes is not None:
        #     if args.address is None:
        #         LOG_ERR("Error: -m should be used with -A.")
        #         return ERR_MISS_ADDRESS_INFO
        #     else:
        #         self.org_modify_bytes = args.modify_bytes
        #
        #         args.modify_bytes = self.__read_modify_data(args.modify_bytes)
        #         if len(args.modify_bytes) == 0:
        #             LOG_ERR("Error: value for -m should be hex value XX:XX:::::XX")
        #             return ERR_INVALID_MODIFY_VALUE

        if args.slot_number is not None:
            self.slot = args.slot_number
            self.args.reboot = True
            self.args.all = True
            self.args.unlock_protected = True

        if self.is_flash_operation() or \
            self.is_reboot() or \
            args.password != None or \
            args.__contains__("run_into_hci") or \
            args.__contains__("load_ram_patch"):
            self.exist_evt_flag = True

        # if args.hci_alive == True and self.getAccessMode() != T_MODE.HCI_MODE:
        #     LOG_ERR("--hci_alive must be used with -M 0!")
        #     return ERR_HCI_ALIVE_NOT_UNDER_M_0

        if self.exist_evt_flag == False:
            LOG_ERR("Error: please specify event flag e.g. -e, -p, -v, -s, -a, -P, -m, -x, -r,-E,-D!")
            return ERR_MISS_EVT_FLAG

        # if args.read_mem:
        #     if args.address is None or \
        #             args.flash_size is None:
        #         LOG_ERR("Error: --read_mem should be used with -A/-S.")
        #         return ERR_MISS_ADDRESS_INFO
        #
        # if args.write_mem is not None:
        #     if args.address is None:
        #         LOG_ERR("Error: --write_mem should be used with -A.")
        #         return ERR_MISS_ADDRESS_INFO
        #     else:
        #         self.org_modify_mem_bytes = args.write_mem
        #
        #         args.modify_mem_bytes = self.__read_modify_data(args.write_mem)
        #         if len(args.modify_mem_bytes) == 0:
        #             LOG_ERR("Error: value for --write_mem should be hex value XX:XX:::::XX")
        #             return ERR_INVALID_MODIFY_VALUE
        # if args.read_efuse:
        #     if args.address is None:
        #         LOG_ERR("Error: --read_efuse should be used with -A.")
        #         return ERR_MISS_ADDRESS_INFO
        #
        # if args.write_efuse:
        #     if args.address is None:
        #         LOG_ERR("Error: --write_efuse should be used with -A.")
        #         return ERR_MISS_ADDRESS_INFO
        #     else:
        #         self.org_modify_efuse_bytes = args.write_efuse
        #
        #         args.modify_efuse_bytes = self.__read_modify_data(args.write_efuse)
        #         if len(args.modify_efuse_bytes) == 0:
        #             LOG_ERR("Error: value for --write_efuse should be hex value XX:XX:::::XX")
        #             return ERR_INVALID_MODIFY_VALUE


        return ERR_OK

    # def __read_modify_data(self, modify_bytes):
    #     '''
    #     :param modify_bytes:new values in hex, separated by colon, maximum 32 bytes "XX:XX:...:XX"
    #     :return: new byte list
    #     '''
    #     new_byte_list = []
    #     for val in modify_bytes.split(":"):
    #         if len(val) != 0:
    #             new_byte_list.append(int(val, 16))
    #         else:
    #             new_byte_list.append(0)
    #     return new_byte_list
