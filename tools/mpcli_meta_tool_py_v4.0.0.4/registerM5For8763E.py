from registerBase import RegisterBase
from DeviceCmdHdl import *
from flashFileParser import *
import re

ROM_VER_V1 = 1 #b cut
ROM_VER_V2 = 2 # c cut
ROM_VER_V3 = 3 # d cut
RAM_PATCH_FOR_8763E_V1 = r"RTL87X3E_V1_ram_patch.bin"
RAM_PATCH_FOR_8763E_V2 = r"RTL87X3E_V2_ram_patch.bin"
RAM_PATCH_FOR_8763E_V3 = r"RTL87X3E_V3_ram_patch.bin"
class RegisterM5For8763E(RegisterBase):
    def __init__(self, cmdParser, devCmdHdl):
        self._cmdParser = cmdParser
        self._devCmdHdl = devCmdHdl
        self._config = self._cmdParser.getConfig()

    def setup(self):
        if self._config.CONFIG_IS_REBOOT_BEFORE_HANDSHAKE:
            reboot_ret = self.__reboot_before_handshake()
            if reboot_ret != ERR_OK:
                return reboot_ret

        cmd_hdl = self._devCmdHdl.get_cmd_hdl(DATA_UART)

        args = self._cmdParser.getArgs()
        if args.__contains__("run_into_hci") and args.run_into_hci == True:
            cmd_hdl.set_handshake_run_hci_mode()

        # open serial
        cfg_info_dict = self._cmdParser.getCfgInfoDict()

        open_ret = cmd_hdl.open(
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME], \
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s at baudrate %d fail!" % ( \
                cfg_info_dict[CFG_DICT_E.SERIAL_INFO.value][
                    UART_ITEM_E.NAME.value], \
                cfg_info_dict[CFG_DICT_E.SERIAL_INFO.value][
                    UART_ITEM_E.OPEN_BAUDRATE.value]))
            return ERR_SERIAL_OPEN_FAIL

        if cmd_hdl.run_into_mp_loader() != ERR_OK:
            cmd_hdl.close()
            return ERR_RUN_INTO_MP_LOADER
        else:
            handshake_type = cmd_hdl.get_handshake_type()
            if handshake_type == HANDSHAKE_TYPE.RUN_HCI_MODE:
                self._devCmdHdl.set_cmd_hdl(HCI_UART)
                LOG_CRITICAL("run into hci mode!")
                if self._cmdParser.is_flash_operation():
                    cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)
                    retCode = cmd_hdl.load_fw()
                    if retCode != ERR_OK:
                        return retCode
                return ERR_OK
            else:
                self._devCmdHdl.set_cmd_hdl(DATA_UART)
                LOG_CRITICAL("run into mp loader!")

            args = self._cmdParser.getArgs()
            # if args.password is not None:
            #     LOG_CRITICAL("->unlock through dbg password, then reboot!")
            #     if cmd_hdl.authenticate_through_password(args.password) != ERR_OK:
            #         LOG_ERR("Error: authenticate_through_password fail!")
            #         return ERR_AUTHEN_THROUGH_PASSWD_FAIL
            #     else:
            #         if cmd_hdl.run_into_mp_loader() != 0:
            #             cmd_hdl.close()
            #             return ERR_RUN_INTO_MP_LOADER
            #         else:
            #             LOG_CRITICAL("run into mp loader after authentication!")

            if (self._config.CONFIG_UPDATE_RAM_PATCH_ENABLE == True):
                ram_patch_path = self.__get_fw_ram_path_by_ic()

                if cmd_hdl.load_ram_patch(ram_patch_path) != ERR_OK:
                    return ERR_DATA_UART_LOAD_RAM_PATCH_FAIL
                elif self._cmdParser.is_flash_operation() == False and \
                        self._cmdParser.is_reboot() == False:
                    return ERR_OK

            if self._cmdParser.is_flash_operation():
                spic_select_ret = cmd_hdl.spic_select()
                if spic_select_ret != ERR_OK:
                    return spic_select_ret

                flash_init_ret = cmd_hdl.flash_init()
                if flash_init_ret != ERR_OK:
                    if self._cmdParser.is_reboot():
                        cmd_hdl.reboot()
                    return flash_init_ret

                cfg_info_dict = self._cmdParser.getCfgInfoDict()
                # pull up baudrate
                if (cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                    UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_115200):
                    if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE] != CONFIG_UART_BAUDRATE_115200:
                        return cmd_hdl.set_baudrate(cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE])

            return ERR_OK
    def __get_fw_ram_path_path(self):
        exe_path = os.path.abspath(sys.argv[0])
        if os.path.isdir(exe_path):
            exe_dir = exe_path
        else:
            exe_dir = os.getcwd()

        args = self._cmdParser.getArgs()
        if args.IC_type:
            fw_dir = os.path.join(exe_dir, "fw", args.IC_type)
        else:
            LOG_ERR("Error: fail tot get IC type.")
        ram_patch_file = os.path.join(fw_dir, self._config.CONFIG_UPDATE_RAM_PATCH_PATH)
        return ram_patch_file
    def __get_fw_ram_path_by_ic(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(DATA_UART)
        ret = cmd_hdl.cmd_get_propety()
        rom_ver = cmd_hdl.get_rom_ver()

        if rom_ver == ROM_VER_V3:
            return self.__get_fw_ram_path_path_by_rom_ver(rom_ver)
        else:
            #LOG_ERR("Error: get ram patch type by ic version fail {} {}!".format(ret,rom_ver))
            return self.__get_fw_ram_path_path()


    def __get_fw_ram_path_path_by_rom_ver(self,rom_ver):
        exe_path = os.path.abspath(sys.argv[0])
        if os.path.isdir(exe_path):
            exe_dir = exe_path
        else:
            exe_dir = os.getcwd()

        args = self._cmdParser.getArgs()
        if args.IC_type:
            fw_dir = os.path.join(exe_dir, "fw", args.IC_type)
        else:
            LOG_ERR("Error: fail tot get IC type.")

        if rom_ver == ROM_VER_V1:
            ram_patch_file = os.path.join(fw_dir, RAM_PATCH_FOR_8763E_V1)
        elif rom_ver == ROM_VER_V2:
            ram_patch_file = os.path.join(fw_dir, RAM_PATCH_FOR_8763E_V2)
        elif rom_ver == ROM_VER_V3:
            ram_patch_file = os.path.join(fw_dir, RAM_PATCH_FOR_8763E_V3)
        return ram_patch_file
    def __hci_reboot(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)
        args = self._cmdParser.getArgs()

        err_ret = cmd_hdl.open(args.comport)
        if err_ret != ERR_OK:
            LOG_ERR("Error: open {} fail".format(args.comport))
            return err_ret
        else:
            err_ret = cmd_hdl.reboot()
            if err_ret != ERR_OK:
                LOG_ERR("Error: hci reboot through {} fail".format(args.comport))
                return err_ret
            else:
                cmd_hdl.close()
        return ERR_OK

    def __bud_reboot(self):
        args = self._cmdParser.getArgs()
        dbg_board_port = self.__get_reboot_port(args.comport)
        if dbg_board_port == "":
            LOG_ERR(
                "Error: fail tot get debug board port from target port %s." % args.comport)
            return ERR_GET_DBG_BOARD_PORT_FAIL

        cmd_hdl = self._devCmdHdl.get_cmd_hdl(CLI_UART)
        open_ret = cmd_hdl.open(dbg_board_port, 2000000)
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s fail!" % dbg_board_port)
            return ERR_SERIAL_OPEN_FAIL

        ret = cmd_hdl.send_bud_reboot()
        cmd_hdl.close()
        return ret

    def __cli_bud_reboot(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(CLI_UART)
        args = self._cmdParser.getArgs()
        open_ret = cmd_hdl.open(args.comport, self._config.CONFIG_APP_CLI_UART_BAUDRATE)
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s fail!" % args.comport)
            return ERR_SERIAL_OPEN_FAIL

        cli_status = cmd_hdl.detect_app_cli_status()
        if cli_status != True:
            cmd_hdl.close()
            return ERR_APP_NOT_IN_CLI_MODE

        cli_help_info = cmd_hdl.get_cli_help()
        if len(cli_help_info) == 0:
            LOG_WARNING("warn: get cli help information return none!")
            cmd_hdl.close()
            return ERR_GET_APP_CLI_HELP_FAIL
        else:
            if "bud" in cli_help_info:
                LOG_DEBUG(cli_help_info)

                ret = cmd_hdl.send_bud_reboot()
                LOG_CRITICAL('''send app cli command: "bud reboot\\r"''')
                cmd_hdl.close()
                return ret
            else:
                return ERR_NOT_SUPPORT_CLI_BUD_REBOOT

    def __reboot_before_handshake(self):
        reboot_type = self._config.CONFIG_REBOOT_TYPE_FOR_HANDSHAKE
        if reboot_type == 0:
            return self.__hci_reboot()
        elif reboot_type == 1:
            return self.__bud_reboot()
        elif reboot_type == 2:
            return self.__cli_bud_reboot()
        else:
            LOG_WARNING("Warning: don't support reboot type {}".format(reboot_type))
            return ERR_OK

    def __get_reboot_port(self,target_port):
        port_str_type_1 = r"tty.usbserial"
        port_str_type_2 = r"ttyUSB"
        port_str_type_3 = r"com"
        if port_str_type_1 in target_port:
            bud_port_info = target_port.split("-")
            board_port_num = hex(int(bud_port_info[1], 16) - 1)[2:].upper()
            dbg_board_port = '-'.join([bud_port_info[0], board_port_num])
            return dbg_board_port
        elif port_str_type_2 in target_port:
            reStr = r"ttyUSB(\d+)"
            port_info = re.search(reStr, target_port)
            if port_info != None:
                bud_port_num = port_info.groups()[0]
                dbg_board_port = target_port.replace(bud_port_num,
                                                     str(int(port_info.groups()[0]) - 1))
                return dbg_board_port
            else:
                LOG_ERR("Error: bud port %s is not supported!" % target_port)
                return ""
        elif port_str_type_3 in target_port:
            dbg_board_port = target_port[0:3] + str(int(target_port[3:]) - 1)
            return dbg_board_port
        else:
            LOG_ERR(
                "Error: bud port is %s, please perfect get_bud_dbg_board_port!" % target_port)
            return ""
        return ""