from HCICmdProto import *
from log import *
from mp_base_def import *
from HCICmdFor8763CV2 import *
from HCICmdFor8763D import *


class HCIAgent(object):
    def __init__(self, config, serialHdl):
        self._config = config
        self._serialHdl = serialHdl
        self._hci_cmd_hdl = None
        self._hci_cmd_dict = {
            IC_87X3D: HCICmdFor8763D,
            IC_87X3E: HCICmdFor8763D,
            IC_87X3EP: HCICmdFor8763D,
            IC_87X3G: HCICmdFor8763D,
        }

    def getCmdHdl(self):
        ic_type = self._config.get_ic_type()

        if self._hci_cmd_dict.__contains__(ic_type):
            self._hci_cmd_hdl = self._hci_cmd_dict[ic_type](self._config, self._serialHdl)
        else:
            LOG_ERR("Error: don't support ic type {} in hci mode".format(ic_type))

        return self._hci_cmd_hdl
