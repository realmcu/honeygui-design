from enum import IntEnum

'''uart baud rate'''
CONFIG_UART_BAUDRATE_1M = 1000000
CONFIG_UART_BAUDRATE_2M = 2000000
CONFIG_UART_BAUDRATE_115200 = 115200
CONFIG_UART_BAUDRATE_230400 = 230400

'''image header'''
MP_HEADER_SIZE = 0x200
IMG_CTRL_HDR_SIZE = 12

SINGLE_WIRE_MODE = 1
TWO_WIRE_MODE = 2
USB_DEV_MODE = 4

'''flash vendor type'''
FLASH_VENDOR_MXIC = 0XC2
FLASH_VENDOR_GD = 0XC8
FLASH_VENDOR_WINBOND = 0XEF
FLASH_VENDOR_FUDAN = 0xA1
FLASH_VENDOR_ESMT = 0x1C


class MP_HEADER_ITEM_ID_ENUM(IntEnum):
    ITEM_BIN_ID = 0x0001
    ITEM_VERSION = 0x0002
    ITEM_PART_NUMBER = 0x0003
    ITEM_DATA_LENGTH = 0x0004
    ITEM_OTA_VERSION = 0x0011
    ITEM_IMAGE_ID = 0x0012
    ITEM_IMAGE_SIZE = 0x0014
    ITEM_SECURE_VERSION = 0x0015
    ITEM_IMAGE_VERSION = 0x0016
    ITEM_BIN_DEPENDENCE = 0x0020
    ITEM_COMMENT = 0x0050
    ITEM_AUTHOR = 0x0051
    ITEM_DATE = 0x0052
    ITEM_REVISION = 0x00FE


class BIN_ID_ENUM(IntEnum):
    ID_SOCV_CONFIG = 0x0101
    ID_OEM_CONFIG = 0x0100
    ID_PATCH = 0x0200
    ID_SYS_PATCH = 0x0201
    ID_STACK_PATCH = 0x0202
    ID_APP = 0x0300
    ID_APP_DATA = 0x0400
    ID_APP_DATA_TONE = 0x0401
    ID_APP_DATA_VP = 0x0402
    ID_APP_DSP_PARAM = 0x0410
    ID_DSP_SYS = 0x0500
    ID_DSP_PATCH = 0x0601
    ID_DSP_SCENARIO1 = 0x0602
    ID_DSP_SCENARIO2 = 0x0603
    ID_FSBL = 0x0700
    ID_OTA_HEADER = 0x0800
    ID_EXT_IMAGE0 = 0x0900
    ID_EXT_IMAGE1 = 0x0901
    ID_EXT_IMAGE2 = 0x0902
    ID_EXT_IMAGE3 = 0x0903
    ID_FACTORY_MP = 0x0A00
    ID_BACKUP_DATA1 = 0x0B00
    ID_BACKUP_DATA2 = 0x0B01


class IMG_ID(IntEnum):
    SCCD = 0x278D
    OCCD = 0x278E
    FactoryCode = 0x278F
    OTA = 0x2790  # OTA header
    SecureBoot = 0x2791
    RomPatch = 0x2792
    AppPatch = 0x2793
    DspPatch = 0x2794
    DspApp = 0x2795
    AppData = 0x2796
    DspData = 0x2797

    ExtImage0 = 0x2798
    ExtImage1 = 0x2799
    ExtImage2 = 0x279A
    ExtImage3 = 0x279B
    SYS_PATCH = 0x279C
    STACK_PATCH= 0x279D

flash_rdid_query_tbl ={
    # MXIC
	FLASH_VENDOR_MXIC:
          {
              0x2314: 5,
	          0x2012: 3,
	          0x2811: 2,
	          0x2812: 3,
	          0x2814: 5,
	          0x2816: 7,
              0x2817: 5
          },
	# Winbond
	FLASH_VENDOR_WINBOND:
        {
            0x4014: 5,
            0x4015: 6,
	        0x4016: 7,
	        0x4017: 7,
	        0x6012: 3,
	        0x6014: 5,
        },
	# GD
	FLASH_VENDOR_GD:
        {
            0x4014: 5,
	        0x4015: 6,
	        0x4016: 7,
	        0x6015: 6,
	        0x6016: 7,
        },
	# ESMT
	FLASH_VENDOR_ESMT:
        {
            0x3014: 5,
            0x3815: 6,
            0x7015: 6,
            0x7016: 7,
        },
	# Fudan
	FLASH_VENDOR_FUDAN:
        {
            0x4013: 4,
	        0x4014: 5,
        },
    }
