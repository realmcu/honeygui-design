import argparse
from version import *


class ArgBase(object):
    def __init__(self):
        show_version()
        self.parser = argparse.ArgumentParser(prog='mpcli',
                                         description='A tool used for flash programming. version %s' % get_version(),
                                         formatter_class=argparse.RawTextHelpFormatter)
        self.parser.add_argument('--version', '-V', action='version',
                                 version='mpcli version %s' % MP_CLI_VERSION,
                                 help="output version information and exit.")
        self.parser.add_argument('-c', dest='comport', help='com port, e.g., -c COM6')
        self.parser.add_argument('-b', dest='modify_baudrate', type=int,
                                 help='''modify baud rate, e.g., -b 9600\
                                         \r\nIt is used in the modifing baudrate procedure.\
                                         \r\nIt can't be used in the uart opening procedure.\
                                         \r\nsetting modifing baudtate priority: -b > -f(the baudrate setting in the json file)\
                                         \r\nIf there is non -b flag and non -f flag,and the opening baudrate is 115200,the default\
                                         \r\nmodifing baudrate is 1000000. \
                                         \r\nIf the opening baudrate is 2000000,it is default not to modify baudrate.''')
        # self.parser.add_argument('--read_mem', dest='read_mem', action="store_true")
        # self.parser.add_argument('--write_mem', dest='write_mem',
        #                          help='''modify bytes in sequence, following new values''')
        # self.parser.add_argument('--read_efuse', dest='read_efuse', action='store_true')
        # self.parser.add_argument('--write_efuse', dest='write_efuse',
        #                          help='''write efuse bytes in sequence, following values''')
        self.parser.add_argument('-B', dest='open_baudrate', type=int,
                                 help='''opening baud rate.\
                                         \r\nIf there's non -B flag,mpcli will use the default baudrate to open serial.\
                                         \r\nfor -M 4.the default opening baudrate is 2000000.\
                                         \r\nfor -M 0/1/2/5,or -I,the default opening baudrate is 115200.\
                                         \r\nadd -B 2000000 for single wire with -M 5''')
        self.parser.add_argument('-e', dest='erase', action='store_true',
                                 help='''erase flash, need to be used with -A and -S together.\
                                     \r\nIf the erasing address is in the SCCD or OCCD flash space,-u flag is needed.''')

        # self.parser.add_argument('-s', dest='savebin', action='store_true',
        #                          help='save flash data, used with -A ,-F and -S together.')

        # self.parser.add_argument('-m', dest='modify_bytes',
        #                          help='''modify bytes in sequence, following new values(in hex, separated by colon,maximum 32 bytes),\
        #                              \r\nneed to be used with -A.\
        #                              \r\nIf the modifing address is in the SCCD or OCCD flash space,-u flag is needed.''')
        self.parser.add_argument('-a', dest='all', action='store_true',
                                 help='''programming all of the binary files from config file.\
                                         \r\nIf -a is enable, -e -p -v -A -F will be ignored,and -f flag is needed.\
                                         \r\nIf the SCCD or OCCD image is to be programmed in the json file,-u flag is needed.''')
        self.parser.add_argument('-F', dest='bin_file',
                                 help='specify the file pathname to save flash content.')
        self.parser.add_argument('-A', dest='address', help='address in Hex, e.g., -A 0x80200')
        self.parser.add_argument('-S', dest='flash_size',
                                 help='size to be erased or saved in bytes, e.g., -S 4096')
        self.parser.add_argument('-f', dest='config_file', action='append', nargs='+',
                                 help='json format config file,see config file rules')
        # self.parser.add_argument('-D', dest='password', help='debug password in Hex, e.g., '
        #                                                      '-D 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF')
        self.parser.add_argument('-r', dest='reboot', action='store_true', help='reboot')
        # self.parser.add_argument('-P', dest='packed_image', help='Packed Image')
        self.parser.add_argument('-M', dest='mode',
                                 help='Mandatory option. Selection of program mode: '
                                      '\r\n5: run into mp loader mode')

        # self.parser.add_argument('-I', dest='ignore_load_rp', action='store_true',
        #                          help='''ignore the ram patch loading procedure,and try to run the cli command load_rp.''')
        self.parser.add_argument('--unlock_protected', '-u', action='store_true',default=True,
                                 help='''the SCCD and OCCD flash space are default protected, neither erase nor program.\
                                         \r\nthe flag -u is used to enable the SCCD and OCCD flash space to be erased and programed.''')
        self.parser.add_argument('-d', dest='disable_merge', action='store_true',default=True,
                                 help='disable merge oem config image')
        self.parser.add_argument('-n', dest='slot_number', const='', nargs='?', action='store',
                                 help='for board / slot number for factory flashing... '
                                      'Also Sets parameters as required for other options to reduce parameter passing')
        self.parser.add_argument('-p', dest='program_flag', action='store_true',
                                 help='flag to enable program operations, used with -A address -F image_path')
        # self.parser.add_argument('--hci_alive', dest='hci_alive', action='store_true',
        #                          default=False,
        #                          help='detect the hci alive status,used with -M 0')
        self.parser.add_argument('-T', dest='IC_type', action='store',
                                 choices=['RTL87X3E','RTL87X3EP','RTL87X3D','RTL87X3G'] ,help="ic type: RTL87X3E,RTL87X3EP,RTL87X3D,RTL87X3G")

    def parse_base_args(self):
        # Parse just the base arguments to determine ic_type
        base_args, remaining_args = self.parser.parse_known_args()
        return base_args, remaining_args

    def reset_flash_address(self,address):
        return address
