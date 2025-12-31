from registerBase import RegisterBase
from DeviceCmdHdl import *
from flashFileParser import *

class RegisterM4(RegisterBase):
    def __init__(self, cmdParser, devCmdHdl):
        self._cmdParser = cmdParser
        self._devCmdHdl = devCmdHdl
        self._config = self._cmdParser.getConfig()

    def setup(self):
        #1. cli : wdt reset
        reset_ret =  self.__reset_target()
        if reset_ret != ERR_OK:
            return reset_ret

        #2. mp loader
        connect_ret = self.__connect_target()
        if connect_ret != ERR_OK:
            return connect_ret
        return ERR_OK


    def __connect_target(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(DATA_UART)

        cfg_info_dict = self._cmdParser.getCfgInfoDict()

        cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE] = CONFIG_UART_BAUDRATE_2M

        #open serial
        open_ret = cmd_hdl.open(
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME], \
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s fail!" % cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME])
            return ERR_SERIAL_OPEN_FAIL

        self._config.set_packet_size(self._config.CONFIG_SINGLE_WIRE_UART_PKT_SIZE)
        if not cmd_hdl.waiting_for_connect():
            LOG_ERR("Error: fail to establish connection between bridge and target in fsbl mp loader!")
            cmd_hdl.close()
            return ERR_CON_MP_LOAD_IN_FSBL
        else:
            LOG_CRITICAL("connection between bridge and target in fsbl mp loader has been established!")

            args = self._cmdParser.getArgs()
            if args.password is not None:
                LOG_CRITICAL("->unlock through dbg password, then reboot!")
                if cmd_hdl.authenticate_through_password(args.password) != ERR_OK:
                    LOG_ERR("Error: authenticate_through_password fail!")
                    return ERR_AUTHEN_THROUGH_PASSWD_FAIL
                else:
                    if not cmd_hdl.waiting_for_connect():
                        LOG_ERR(
                            "Error: fail to establish connection between bridge and target in fsbl mp loader!")
                        cmd_hdl.close()
                        return ERR_CON_MP_LOAD_IN_FSBL
                    else:
                        LOG_CRITICAL(
                            "connection between bridge and target in fsbl mp loader has been established!")
                        return ERR_OK
            else:
                return ERR_OK

    def __reset_target(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(CLI_UART)
        cfg_info_dict = self._cmdParser.getCfgInfoDict()

        open_ret = cmd_hdl.open(cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME])
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s fail!" % cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.NAME])
            return ERR_SERIAL_OPEN_FAIL

        if cmd_hdl.wdt_reset_cli() != ERR_OK:
            LOG_CRITICAL("Please reset target device through reset button!")
        cmd_hdl.close()
        return  ERR_OK




