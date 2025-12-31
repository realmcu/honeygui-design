from cmdParser import *
from DeviceCmdHdl import *
import serial
import re


class RegisterE(object):
    def __init__(self, cmdParser):
        self._cmdParser = cmdParser
        self._config = self._cmdParser.getConfig()

    def setup(self):
        cfg_info_dict = self._cmdParser.getCfgInfoDict()
        target_port = cfg_info_dict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.NAME]

        dbg_port = self.get_dbg_board_port(target_port)
        if dbg_port == "":
            LOG_ERR(
                "Error: fail tot get debug board port from bud port %s." % target_port)
            return ERR_GET_DBG_BOARD_PORT_FAIL

        retCode = self.enter_hci_mode_through_dbg_board(dbg_port)
        if retCode != ERR_OK:
            LOG_ERR("Error: fail to enter hci mode through debug board!")
            return retCode

        return ERR_OK

    def get_dbg_board_port(self,target_port):
        port_str_type_1 = r"tty.usbserial"
        port_str_type_2 = r"ttyUSB"
        port_str_type_3 = r"com"
        if port_str_type_1 in target_port:
            bud_port_info = target_port.split("-")
            board_port_num = hex(int(bud_port_info[1], 16) + 1)[2:].upper()
            dbg_board_port = '-'.join([bud_port_info[0], board_port_num])
            return dbg_board_port
        elif port_str_type_2 in target_port:
            reStr = r"ttyUSB(\d+)"
            port_info = re.search(reStr, target_port)
            if port_info != None:
                bud_port_num = port_info.groups()[0]
                dbg_board_port = target_port.replace(bud_port_num,
                                                     str(int(port_info.groups()[0]) + 1))
                return dbg_board_port
            else:
                LOG_ERR("Error: bud port %s is not supported!" % target_port)
                return ""
        elif port_str_type_3 in target_port:
            dbg_board_port = target_port[0:3] + str(int(target_port[3:]) + 1)
            return dbg_board_port
        else:
            LOG_ERR(
                "Error: bud port is %s, please perfect get_bud_dbg_board_port!" % target_port)
            return ""
        return ""

    def enter_hci_mode_through_dbg_board(self, debug_board_port):
        dbgboard_ser = None
        try:
            dbgboard_ser = serial.Serial(debug_board_port, baudrate=2000000, timeout=0.8)
            dbgboard_ser.flushOutput()
            dbgboard_ser.write('\r\n'.encode('ascii'))
            time.sleep(self._config.CONFIG_DBG_BOARD_WAIT_FOR_CONSOLE_S)
            dbgboard_ser.flushInput()

            dbgboard_ser.write('bud put_hci_mode\r\n'.encode('ascii'))
            rsp = dbgboard_ser.read(128)
            rsp = rsp.decode('utf-8', errors='ignore')
            LOG_CRITICAL(rsp)
        except serial.SerialException as err:
            LOG_ERR(err)
        finally:
            if dbgboard_ser != None:
                dbgboard_ser.close()
                time.sleep(self._config.CONFIG_WAIT_TO_ENTER_HCI_MODE_S)
                return ERR_OK
            else:
                return ERR_DBG_BOARD_ENTER_HCI_MODE_FAIL
