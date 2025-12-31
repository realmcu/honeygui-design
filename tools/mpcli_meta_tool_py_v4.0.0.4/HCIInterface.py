import abc


class HCIInterface(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def open(self, serialName, baudrate=115200):
        pass

    @abc.abstractmethod
    def close(self):
        pass

    @abc.abstractmethod
    def load_fw(self):
        pass

    @abc.abstractmethod
    def set_baudrate(self, baudrate):
        pass

    @abc.abstractmethod
    def page_erase(self, addr, size):
        pass

    @abc.abstractmethod
    def program(self, dl_obj, dl_addr, dl_size):
        pass

    @abc.abstractmethod
    def read(self, addr, rd_size, save_obj):
        pass

    @abc.abstractmethod
    def verify(self, img_path, img_addr):
        pass

    @abc.abstractmethod
    def reboot(self):
        pass

    @abc.abstractmethod
    def check_mode(self):
        pass

    @abc.abstractmethod
    def send_dbg_passwd(self, port, baudrate, passwd):
        pass
