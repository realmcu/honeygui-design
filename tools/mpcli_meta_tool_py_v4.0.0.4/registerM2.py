from registerBase import RegisterBase
from flashFileParser import *
from DeviceCmdHdl import *
from registerE import *

class RegisterM2(RegisterBase):
    def __init__(self, cmdParser, devCmdHdl):
        self._cmdParser = cmdParser
        self._devCmdHdl = devCmdHdl
        self._config = self._cmdParser.getConfig()
        self.args = self._cmdParser.getArgs()


    def setup(self):
        if self._config.CONFIG_SECURE_DEVICE_ON_PRODUCTION == False:
            load_ret = self.__pre_dl_ram_patch()
            if load_ret != ERR_OK:
                LOG_ERR("Error: fail to download factory mp image for M 2!")
                return load_ret

        return self.__access_into_ram_patch()

    def __access_into_ram_patch(self):
        accrss_rst = ERR_OK
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(DATA_UART)

        cfg_info_dict = self._cmdParser.getCfgInfoDict()
        open_ret = cmd_hdl.open(
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME], \
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s fail!" % cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.NAME])
            return ERR_SERIAL_OPEN_FAIL

        need_try_load_rp = True  # need to try load_rp
        data_access_ret = cmd_hdl.detect_data_access()
        if data_access_ret == ERR_OK:
            need_try_load_rp = False
            if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_2M:
                self._config.set_packet_size(self._config.CONFIG_SINGLE_WIRE_UART_PKT_SIZE)

        elif (self._config.CONFIG_SECURE_DEVICE_ON_PRODUCTION == False):
            '''
               if CONFIG_SECURE_DEVICE_ON_PRODUCTION is False, boot patch will be downloaded.
               if ram patch running status is not ok, there is something wrong with the boot patch image.
            '''
            LOG_CRITICAL(
                "CONFIG_SECURE_DEVICE_ON_PRODUCTION is False, ram path will be downloaded!")
            LOG_CRITICAL("ram patch is not running ok under FLASH_PATCH_MODE mode!")

            return ERR_FLASH_PATCH_ABNORMAL
        elif self.args.__contains__("easy_mode") and self.args.easy_mode:
            '''
                with -E flag, the device is under hci mode.
                need to reboot the device, then detect the ram patch status.
            '''
            LOG_ERR("Error:ram patch is not running ok!")
            LOG_CRITICAL("with -E, the device is now under hci mode!")
            LOG_CRITICAL("next to reboot to detect ram patch status......")

            cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)
            cmd_hdl.reboot()
            time.sleep(self._config.CONFIG_WAIT_FOR_APP_RUN_S)
        else:
            '''
               specified with -M 2 or autodected as -M 2, but the ram patch is not running ok.

               need to try reboot to detect load_rp, then try hci mode.

               if the device is bud with debug board, enter into hci mode through "bud put_into_hci", or else
               print log to indicate the user.

            '''
            LOG_ERR("Error:ram patch is not running ok under FLASH_PATCH_MODE mode!")

            LOG_CRITICAL("\tfor secure evb, the device status is not ready for -M 2, user can try to add -M 0 in the command.")
            LOG_CRITICAL("\tfor bud with debug board,it's recommended to add -E in the command,\n\tthe device can enter into hci mode through debug board!")
            LOG_CRITICAL("\tfor bud without debug board, the next procedure will fail! User can stop the running manually!")
            LOG_CRITICAL("\nnext to detect load_rp!")

        '''
        start to detect load_rp
        '''
        if need_try_load_rp:
            cmd_hdl.close()
            LOG_CRITICAL("\nstart to try load_rp......")
            '''
             try -I mode to load_rp for DVT reflashing
            '''
            cmd_hdl = self._devCmdHdl.get_cmd_hdl(CLI_UART)
            if cmd_hdl.pre_ignore_load_ram_patch(self.args.comport) != ERR_OK:
                '''
                load_fp fail, then try to enter into hci mode
                '''
                # Factory passes slot and does not use the interface board to put DUT in HCI mode
                if self._cmdParser.get_slot() != '':
                    LOG_CRITICAL("Load rp failed in factory multi-flash - do not try HCI Mode......")
                    return ERR_WITH_SLOT_NOT_IN_HCI_MODE
                LOG_ERR("Error: try to load_rp fail!\n")

                if self.args.__contains__("easy_mode") and self.args.easy_mode:
                    retCode = RegisterE(self._cmdParser).setup()
                    if retCode != ERR_OK:
                        return retCode
                    else:
                        self._devCmdHdl.set_cmd_hdl(HCI_UART)
                        LOG_CRITICAL("enter HCI mode through -E!")
                else:
                    LOG_CRITICAL("-M 2 not work well!!!")
                    LOG_CRITICAL("Maybe you can try to make the device into hci mode and specify the command line with -M 0!")
                    return ERR_CANNOT_ENTER_HCI_AUTOMATIC
            else:
                self._devCmdHdl.set_cmd_hdl(DATA_UART)
                if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_2M:
                    self._config.set_packet_size(self._config.CONFIG_SINGLE_WIRE_UART_PKT_SIZE)


            accrss_rst = self.__open_uart()
            if accrss_rst != ERR_OK:
                return accrss_rst
        else:
            # pull up baudrate
            if (cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_115200):
                if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                    UART_ITEM_E.MODIFY_BAUDRATE] != CONFIG_UART_BAUDRATE_115200:
                    accrss_rst = cmd_hdl.set_baudrate(cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE])
                    if accrss_rst != ERR_OK:
                        return  accrss_rst
        if self._config.get_ic_type() == IC_8763C_V2:
            if self._cmdParser.is_flash_operation():
                cmd_hdl = self._devCmdHdl.get_cmd_hdl(DATA_UART)
                spic_select_ret = cmd_hdl.spic_select()
                if spic_select_ret != ERR_OK:
                    return spic_select_ret

                flash_init_ret = cmd_hdl.flash_init()
                if flash_init_ret != ERR_OK:
                    return flash_init_ret

                flash_load_cfg_ret = cmd_hdl.flash_load_cfg()
                if flash_load_cfg_ret != ERR_OK:
                    return flash_load_cfg_ret

        return ERR_OK

    def __pre_dl_ram_patch(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)
        cfg_info_dict = self._cmdParser.getCfgInfoDict()
        open_ret = cmd_hdl.open(self.args.comport,cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
        if open_ret != 0:
            LOG_ERR("Error: open %s fail!" % self.args.comport)
            return ERR_SERIAL_OPEN_FAIL

        load_fw_ret = cmd_hdl.load_fw()
        if load_fw_ret != ERR_OK:
            LOG_ERR("Error: load firmware fail!")
            return load_fw_ret

        set_baudrate_ret = cmd_hdl.set_baudrate(CONFIG_UART_BAUDRATE_1M)
        if set_baudrate_ret != ERR_OK:
            return set_baudrate_ret

        ret_code =  self.__load_ram_patch_for_M2()
        if ret_code != ERR_OK:
            LOG_ERR("Error: load ram patch for M 2 fail code {}!".format(ret_code))
            cmd_hdl.close()
            return ERR_HCI_LOAD_FACTORY_MP_FAIL

        cmd_hdl.reboot()
        time.sleep(self._config.CONFIG_HCI_WAIT_FOR_REBOOT_S)
        cmd_hdl.close()

        return ERR_OK

    def __load_ram_patch_for_M2(self):
        '''
          download ram patch to flash 0x1804000(non-cache)
          CONFIG_RAM_PATCH_ADDRESS
          CONFIG_RAM_PATCH_IMAGE
          '''

        exe_path = os.path.abspath(sys.argv[0])
        if os.path.isdir(exe_path):
            exe_dir = exe_path
        else:
            exe_dir = os.getcwd()

        fw_dir = os.path.join(exe_dir, "fw")
        ram_patch_file = os.path.join(fw_dir, self._config.CONFIG_FACTORY_MP_LOADER_IMAGE)

        cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)

        ret_code = self._devCmdHdl.download_image(ram_patch_file, self._config.CONFIG_FACTORY_MP_LOADER_ADDRESS)
        if ret_code != ERR_OK:
            LOG_ERR("Error: download ram patch %s fail" % ram_patch_file)
            return ret_code
        else:
            LOG_CRITICAL("load ram patch to 0x%08x success!" %  self._config.CONFIG_FACTORY_MP_LOADER_ADDRESS)
            return ERR_OK

    def __open_uart(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl()
        cfg_info_dict = self._cmdParser.getCfgInfoDict()

        open_ret = cmd_hdl.open(self.args.comport,cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
        if open_ret != 0:
            LOG_ERR("Error: open %s fail!" % self.args.comport)
            return ERR_SERIAL_OPEN_FAIL
        else:
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.OPEN_BAUDRATE] = cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE]
            if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE] == 0:
                cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE] = self._config.CONFIG_SERIAL_DEFAULT_MODIFY_BAUDRATE

        load_fw_ret = cmd_hdl.load_fw()
        if load_fw_ret != ERR_OK:
            LOG_ERR("Error: load firmware fail!")
            return load_fw_ret

        # pull up baudrate
        if (cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
            UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_115200):
            if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.MODIFY_BAUDRATE] != CONFIG_UART_BAUDRATE_115200:
                return cmd_hdl.set_baudrate(cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.MODIFY_BAUDRATE])

        return ERR_OK

