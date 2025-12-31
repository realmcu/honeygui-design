import abc


class MPLoaderInterface(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def open(self, serialName, baudrate=115200):
        pass

    @abc.abstractmethod
    def close(self):
        pass
    @abc.abstractmethod
    def load_fw(self,prog_mode):
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
    def read(self, addr, rd_size, save_Obj):
        pass

    @abc.abstractmethod
    def verify(self, img_path, img_addr):
        pass

    @abc.abstractmethod
    def reboot(self):
        pass

    @abc.abstractmethod
    def exit_mp_loader(self,mp_boot_type=0):
        pass

