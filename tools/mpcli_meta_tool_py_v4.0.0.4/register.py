from registerM0 import RegisterM0
from registerM1 import RegisterM1
from registerM2 import RegisterM2
from registerM4 import RegisterM4
from registerM5Agent import RegisterM5Agent
from registerE import RegisterE
from log import *

from err_def import *


class Register(object):
    supportedMode = {0: RegisterM0,
                     1: RegisterM1,
                     2: RegisterM2,
                     4: RegisterM4,
                     5: RegisterM5Agent}

    def __init__(self, cmdParser, devCmdHdl):
        self.accessDict = {}
        self._cmdParser = cmdParser
        self._devCmdHdl = devCmdHdl
        self.regModeObj = None
        pass

    def setup(self, accessMode):
        if Register.supportedMode.__contains__(accessMode):
            self.regModeObj = Register.supportedMode[accessMode](self._cmdParser,
                                                                 self._devCmdHdl)
        else:
            return ERR_UNSUPPORTED_MODE

        return self.regModeObj.setup()
