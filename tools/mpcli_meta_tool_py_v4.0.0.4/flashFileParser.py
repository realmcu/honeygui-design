import os
import json
import tempfile
import struct
from enum import IntEnum
from log import *
from mp_setting import *
from mp_base_def import *
from flashFileParserBase import FlashFileParserBase
from flashFileParser8763D import FlashFileParser8763D
from flashFileParser8763E import FlashFileParser8763E

class UART_ITEM_E(IntEnum):
    NAME = 0
    OPEN_BAUDRATE = 1
    MODIFY_BAUDRATE = 2


class CFG_DICT_E(IntEnum):
    SERIAL_INFO = 0
    JSON_INFO = 1


class FlashFileParser(object):
    def __init__(self, config):
        self._config = config
        self._json_parser_hdl = None
        self._jsonParserDict = {
             IC_87X3D: FlashFileParser8763D,
             IC_87X3E: FlashFileParser8763E,
             IC_87X3EP: FlashFileParser8763E,
             IC_87X3G: FlashFileParser8763E,
        }

    def getParser(self):
        ic_type = self._config.get_ic_type()

        if self._jsonParserDict.__contains__(ic_type):
            self._json_parser_hdl = self._jsonParserDict[ic_type](self._config)
        else:
            LOG_ERR("Error: don't support ic type {} in to get flash json file parser handle".format(
                ic_type))

        return self._json_parser_hdl