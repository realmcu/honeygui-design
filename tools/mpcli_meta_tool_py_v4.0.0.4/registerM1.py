from registerBase import RegisterBase
from DeviceCmdHdl import *
from flashFileParser import *

class RegisterM1(RegisterBase):
    def __init__(self, cmdParser, devCmdHdl):
        self._cmdParser = cmdParser
        self._devCmdHdl = devCmdHdl
        self._config = self._cmdParser.getConfig()

    def setup(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)

        args = self._cmdParser.getArgs()

        # open serial
        cfg_info_dict = self._cmdParser.getCfgInfoDict()
        open_ret = cmd_hdl.open(
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME], \
            cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
        if open_ret != ERR_OK:
            LOG_ERR("Error: open %s fail!" % cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.NAME])
            return ERR_SERIAL_OPEN_FAIL

        #load firmware
        prog_mode = self._cmdParser.getAccessMode()
        fw_ldr_ic_info = []
        load_fw_ret = cmd_hdl.autodetect_firmware(prog_mode,fw_ldr_ic_info)
        if load_fw_ret != ERR_OK:
            LOG_ERR("Error: autodetect load firmware fail!")
            return load_fw_ret
        else:
            LOG_CRITICAL("Download FW success, prepare to trigger")

        #trigger firmware
        trigger_ret = cmd_hdl.trigger_fw_loader(fw_ldr_ic_info, prog_mode)
        if trigger_ret != ERR_OK:
            LOG_ERR("Error: trigger firmware fail!")
            return trigger_ret
        else:
            self._devCmdHdl.set_cmd_hdl(DATA_UART)
            cmd_hdl = self._devCmdHdl.get_cmd_hdl(DATA_UART)

        # pull up baudrate
        if (cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
            UART_ITEM_E.OPEN_BAUDRATE] == CONFIG_UART_BAUDRATE_115200):
            if cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                UART_ITEM_E.MODIFY_BAUDRATE] != CONFIG_UART_BAUDRATE_115200:
                retCode = cmd_hdl.set_baudrate(
                    cfg_info_dict[CFG_DICT_E.SERIAL_INFO][
                        UART_ITEM_E.MODIFY_BAUDRATE])
                if retCode != ERR_OK:
                    return retCode
        return ERR_OK





