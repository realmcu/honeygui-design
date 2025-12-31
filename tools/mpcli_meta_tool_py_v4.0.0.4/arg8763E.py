import argparse
from version import *
from argbase import ArgBase



class Arg8763E(ArgBase):
    def __init__(self):
        super(Arg8763E, self).__init__()

    def createArgs(self):
        parser = argparse.ArgumentParser(prog='mpcli',
                                         description='A tool used for flash programming. version %s' % get_version(),
                                         parents=[self.parser],
                                         add_help=False,
                                         formatter_class=argparse.RawTextHelpFormatter)
        parser.add_argument('--run_into_hci', dest='run_into_hci', action='store_true',
                            help='only used with -M 5, handshake with comand 0x20B0')
        parser.add_argument('--exit_mp', dest='exit_mp_loader',type = int, default=-1,
                            help= 'exit mp loader boot type option. Selection of program mode: '
                                  '\r\n0: keep boot type'
                                  '\r\n1: bypass flash'
                                  '\r\n2: normal boot')
        parser.add_argument('--chip_erase', dest='is_chip_erase', action='store_true',
                            help='only used with -M 5')
        return parser
    def reset_flash_address(self,address):
        return address
