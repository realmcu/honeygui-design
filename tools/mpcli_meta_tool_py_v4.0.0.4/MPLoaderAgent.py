from MPLoaderFor8763D import *
from MPLoaderFor87x3E import *
from MPLoaderFor8773E import *
from MPLoaderFor87x3G import *
from log import *
from mp_base_def import *


class MPLoaderAgent(object):
    def __init__(self, config, serialHdl):
        self._config = config
        self._mp_loader_hdl = None
        self._mp_loader_dict = {
            IC_87X3D: MPLoaderFor8763D,
            IC_87X3E: MPLoaderFor87x3E,
            IC_87X3EP: MPLoaderFor8773E,
            IC_87X3G: MPLoaderFor87x3G}
        self._serialHdl = serialHdl

    def getCmdHdl(self):
        ic_type = self._config.get_ic_type()
        if self._mp_loader_dict.__contains__(ic_type):
            self._mp_loader_hdl = self._mp_loader_dict[ic_type](self._config,
                                                                self._serialHdl)
        else:
            LOG_ERR("Error: don't support ic type {}".format(ic_type))
        return self._mp_loader_hdl
