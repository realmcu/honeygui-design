from log import *
from err_def import *
from registerBase import RegisterBase
from DeviceCmdHdl import *
from registerM5For8763D import RegisterM5For8763D
from registerM5For8773E import RegisterM5For8773E
from registerM5For8763E import RegisterM5For8763E
from registerM5For87x3G import RegisterM5For87x3G
class RegisterM5Agent(RegisterBase):
    M5_support_dict = {
        IC_87X3D: RegisterM5For8763D,
        IC_87X3E: RegisterM5For8763E,
        IC_87X3EP: RegisterM5For8773E,
        IC_87X3G: RegisterM5For87x3G,
    }
    def __init__(self, cmdParser, devCmdHdl):
        self._cmdParser = cmdParser
        self._devCmdHdl = devCmdHdl
        self._config = self._cmdParser.getConfig()
        self.regModeObj = None

    def setup(self):
        ic_type = self._config.get_ic_type()

        if RegisterM5Agent.M5_support_dict.__contains__(ic_type):
            self.regModeObj = RegisterM5Agent.M5_support_dict[ic_type](self._cmdParser,
                                                                 self._devCmdHdl)
        else:
            return ERR_UNSUPPORTED_MODE

        return self.regModeObj.setup()

