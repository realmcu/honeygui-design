import sys
from cfgParser import CfgParser
from device import Device
from cmdParser import CommandParser
from mp_utility import dump_retry_statistic
from log import *
from argbase import *
import time

if os.name=="nt":
    import ctypes
    import ctypes.wintypes

def main():
    # 0.parse IC_type first from argparser
    ICArgParser = ArgBase()
    base_args, remaining_args = ICArgParser.parse_base_args()
    if (not base_args.__contains__("IC_type")) or base_args.IC_type == None:
        LOG_CRITICAL("Please specify ic type by -T")
        return

    # 1.config  create & parse
    config = CfgParser(base_args.IC_type)
    parseRet = config.parse()
    if parseRet != ERR_OK:
        return parseRet

    # 2.create CommandParser
    cmdParser = CommandParser(config)
    parseRet = cmdParser.createArgParser()
    if parseRet != ERR_OK:
        return parseRet

    parseRet = cmdParser.parserCmd()
    if parseRet != ERR_OK:
        return parseRet

    # 3.create Device
    devObj = Device(config, cmdParser)
    accessRet = devObj.setup()
    if accessRet != ERR_OK:
        return accessRet

    # 4.handle operation
    cmdHdlRet = devObj.cmdHdl()

    devObj.disconnect()

    return cmdHdlRet


if __name__ == "__main__":
    t1 = time.time()
    LOG_CRITICAL(' '.join(sys.argv))

    if os.name == "nt":
        kernel32 = ctypes.windll.kernel32
        console_handle = kernel32.GetStdHandle(-10) #STD_INPUT_HANDLE

        original_mode = ctypes.wintypes.DWORD()
        kernel32.GetConsoleMode(console_handle, ctypes.pointer(original_mode))

        ENABLE_EXTENDED_FLAGS = 0x0080
        ENABLE_PROCESSED_INPUT = 0x0001

        kernel32.SetConsoleMode(console_handle, ENABLE_EXTENDED_FLAGS|ENABLE_PROCESSED_INPUT)
        LOG_DEBUG("default console mode :{}".format(original_mode))

    ret = main()
    for hdl in log.get_handlers():
        hdl.close()
    # summary retries
    dump_retry_statistic()
    t2 = time.time()
    if ret == ERR_OK:
        LOG_CRITICAL("MPCLI exit: success.")
    else:
        LOG_CRITICAL("MPCLI exit: fail with errcode {}.".format(ret))
    LOG_CRITICAL("time {} s".format(t2-t1))
    if os.name == "nt":
        kernel32.SetConsoleMode(console_handle, original_mode)
    sys.exit(ret)
