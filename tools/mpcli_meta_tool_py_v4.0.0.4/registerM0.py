from registerBase import RegisterBase
from cmdParser import *
from DeviceCmdHdl import *
import time


class RegisterM0(RegisterBase):
    def __init__(self, cmdParser, devCmdHdl):
        self._cmdParser = cmdParser
        self._devCmdHdl = devCmdHdl
        self._config = self._cmdParser.getConfig()

    def setup(self):
        mp_func_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)

        args = self._cmdParser.getArgs()
        cfg_info_dict = self._cmdParser.getCfgInfoDict()
        # -D
        if args.password is not None:
            # unlock or reboot through -D
            retCode = mp_func_hdl.send_dbg_passwd(args.comport,
                                                  cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE],
                                                  args.password)
            if retCode != ERR_OK:
                return retCode
            else:
                if self._cmdParser.is_flash_operation():
                    time.sleep(self._config.CONFIG_SLEEP_AFTER_DBG_PASSWORD_S)
                else:
                    return ERR_OK

        # open serial
        open_ret = mp_func_hdl.open(
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME], \
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s fail!" % cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.NAME])
            return ERR_SERIAL_OPEN_FAIL

        # load firmware
        if self._cmdParser.is_flash_operation():
            retCode = mp_func_hdl.load_fw()
            if retCode != ERR_OK:
                return retCode

            # pull up baudrate
            if (cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_115200):
                if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                    UART_ITEM_E.MODIFY_BAUDRATE] != CONFIG_UART_BAUDRATE_115200:
                    retCode = mp_func_hdl.set_baudrate(
                        cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                            UART_ITEM_E.MODIFY_BAUDRATE])
                    if retCode != ERR_OK:
                        return retCode
        return ERR_OK
