from MPLoaderAgent import *
from HCIAgent import *


'''uart type'''
HCI_UART = 0    #hci command
DATA_UART = 1   #mp loader command


class DeviceCmdHdl(object):
    def __init__(self, config, serialHdl):
        self._config = config
        self._serialHdl = serialHdl
        self._mp_loader_hdl = MPLoaderAgent(self._config, self._serialHdl).getCmdHdl()
        self._hci_hdl = HCIAgent(self._config, self._serialHdl).getCmdHdl()

        self.dev_cmd_dict = {HCI_UART: self._hci_hdl,
                             DATA_UART: self._mp_loader_hdl,
                             }
        self._dev_cmd_hdl = None  # self._mp_loader_hdl or self._hci_hdl
        self._uart_type = HCI_UART

    def getConfig(self):
        return self._config

    def set_cmd_hdl(self, uart_type):
        self._uart_type = uart_type

    def get_uart_type(self):
        return self._uart_type

    def get_cmd_hdl(self, uart_type=None):
        if uart_type == None:
            uart_type = self._uart_type
        else:
            self._uart_type = uart_type

        if self.dev_cmd_dict.__contains__(uart_type):
            return self.dev_cmd_dict[uart_type]
        else:
            LOG_ERR("Error: don't support uart type {}".format(uart_type))
            return None
