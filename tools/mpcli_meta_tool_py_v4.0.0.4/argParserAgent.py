from argbase import ArgBase
from arg8763D import Arg8763D
from arg8763E import Arg8763E
from arg8773G import Arg8773G
from log import *
from mp_base_def import *


class ArgParserAgent(object):
    def __init__(self, config):
        self._config = config
        self.argParserDict = {IC_87X3D: Arg8763D,
                              IC_87X3E: Arg8763E,
                              IC_87X3EP: Arg8763E,
                              IC_87X3G: Arg8773G}
        self._argParser = None
        self._argHdl = None

    def create_arg_parser(self):
        ic_type = self._config.get_ic_type()
        LOG_CRITICAL("ic type: {}".format(ic_type))

        if self.argParserDict.__contains__(ic_type):
            self._argHdl = self.argParserDict[ic_type]()
            self._argParser = self._argHdl.createArgs()
        else:
            LOG_ERR(
                "Error: don't support ic type {} in create_arg_parser".format(ic_type))

        return self._argParser
    def reset_flash_address(self,address):
        return self._argHdl.reset_flash_address(address)
