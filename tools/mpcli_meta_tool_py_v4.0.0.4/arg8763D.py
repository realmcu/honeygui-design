import argparse
from version import *
from argbase import ArgBase



class Arg8763D(ArgBase):
    def __init__(self):
        super(Arg8763D, self).__init__()

    def createArgs(self):
        parser = argparse.ArgumentParser(prog='mpcli',
                                         description='A tool used for flash programming. version %s' % get_version(),
                                         parents=[self.parser],
                                         add_help=False,
                                         formatter_class=argparse.RawTextHelpFormatter)
        parser.add_argument('--run_into_hci', dest='run_into_hci', action='store_true',
                            help='only used with -M 5, handshake with comand 0x20B0')
        parser.add_argument('--chip_erase', dest='is_chip_erase', action='store_true',
                            help='only used with -M 5')
        return parser
    def reset_flash_address(self,address):
        return ((address&(~0x02000000))|0x04000000)
