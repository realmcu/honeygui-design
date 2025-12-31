from enum import IntEnum

MP_START_BYTE = 0x87
class REBOOT_TYPE(IntEnum):
    RESET_ALL_EXCEPT_AON = 0
    RESET_ALL = 1
class MP_BOOT_TYPE(IntEnum):
    MP_BOOT_TYPE_KEEP = 0
    MP_BYPASS_FLASH = 0
    MP_NORAMAL_BOOT = 1

class CmdID(IntEnum):
    CMD_GET_PROPERTY = 0x1000
    CMD_GET_SYSTEM_CONFIG = 0x1001
    CMD_SET_SYSTEM_CONFIG = 0x1002
    CMD_FLASH_IO_CTRL = 0x1003
    CMD_SPIC_SELECT = 0x1004

    CMD_SET_BAUDRATE = 0x1010

    CMD_PAGE_ERASE = 0x1030
    CMD_CHIP_ERASE = 0x1031
    CMD_PROGRAM = 0x1032
    CMD_READ = 0x1033

    CMD_GO = 0x1040,
    CMD_REBOOT = 0x1041
    CMD_EXIT_MP_LOADER = 0x1042

    CMD_EFLASH_VERIFY = 0x1050
    CMD_GET_APP_EUID = 0x1060
    CMD_EFUSE_BURN = 0x1061
    CMD_ENTER_DBG_PWD = 0x1070  # 0x1070
    CMD_MEM_WRITE = 0x1080  # 0x1080
    CMD_MEM_READ = 0x1081
    CMD_WRITE_EFUSE_DATA   = 0x1082
    CMD_READ_EFUSE_DATA    = 0x1083
    CMD_READ_EFUSE_ON_RAM  = 0x1084

    CMD_LOAD_RAM_PATCH = 0x1090  # 0x1090
    CMD_RUN_MP_LOADER = 0x20A0  # 0x20A0  /* Run MP loader @ Boot Stage, use param to enable log or not */
    CMD_RUN_HCI_MODE = 0x20B0  # 0x20B0  /* Enter HCI mode @ Boot Stage */
class CmdIDV2(IntEnum):
    #support in 8763D
    CMD_FLASH_INIT = 0x103E
class CMDIDV3(IntEnum):
    #support in 8773E
    CMD_GET_FLASH_TYPE = 0x1005
    CMD_BLOCK128_ERASE = 0x1036
    CMD_BLOCK64_ERASE = 0x1035
class CMDIDV4(IntEnum):
    #only for nor or nand flash
    CMD_FLASH_PAGE_ERASE_V2     = 0x2030  #only for nor flash
    CMD_FLASH_BLOCK64_ERASE_V2  = 0x2031  #only for nor flash

    CMD_FLASH_BLOCK128_ERASE_V2 = 0x2032   #only for nand flash

    CMD_FLASH_PROGRAM_V2  = 0x2033
    CMD_FLASH_READ_V2     = 0x2034
    CMD_FLASH_VERIFY_V2   = 0x2035
    CMD_FLASH_GET_BLOCK_SIZE = 0x2036,  #only for nand flash
    CMD_FLASH_BLOCK256_ERASE_V2 = 0x2037, #only for nand flash with 256KBytes block

    # only for SD nand/eMMC
    CMD_SD_INIT        = 0x2040
    CMD_SD_SEC_ERASE   = 0x2041
    CMD_SD_PROGRAM     = 0x2042
    CMD_SD_READ        = 0x2043
    CMD_SD_VERIFY      = 0x2044
    CMD_SD_GET_CAPACITY = 0x2045,
    CMD_SD_SET_BASE_ADDR = 0x2046,
    CMD_SD_GET_BASE_ADDR = 0x2047,

    CMD_ENTER_FT_MODE = 0x1043,
