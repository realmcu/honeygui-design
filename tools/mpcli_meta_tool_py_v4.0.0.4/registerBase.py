import abc


class RegisterBase(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def setup(self, cmdParser, mpCmdHdl):
        pass
