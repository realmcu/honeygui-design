from enum import IntEnum

'''
supported ic type definition
'''
IC_87X3D = "IC_87X3D"
IC_87X3E = "IC_87X3E"
IC_87X3EP = "IC_87X3EP"
IC_87X3G = "IC_87X3G"

class T_MODE(IntEnum):
    HCI_MODE = 0  # HCI Mode
    RAM_PATCH_VENDOR_WRITE_MODE = 1  # RAM Patch, trigger by HCI Vendor Write
    FLASH_PATCH_MODE = 2  # Flash Patch
    RAM_PATCH_MODE = 3  # RAM Patch, trigger by WDG Reset
    FSBL_PATCH_MODE = 4  # FSBL Patch, use single wire UART
    RUN_MP_LOADER_MODE = 5  # run into mp loader
    T_MODE_MAX_VAL = 6

class QUERY_TABLE_IDX(IntEnum):
    IDX_MAGIC_WORD = 0
    IDX_IC_ID = 1
    IDX_ROM_VER = 2

g_query_table = [
    (0x0256F8B5,0x8763,0x01), #RTL8763B B/C-Cut
    (0xFF93F7FF,0x8763,0x03), #RTL8763B D-Cut
    (0x215DF640,0x8763,0x04), #RTL8763B E-Cut
    (0x0,0x8763C,0x04)] #RTL8763c A cut

class FW_LDR_INFO_IDX(IntEnum):
    FW_LDR_IDX_PROG_MODE = 0
    FW_LDR_IDX_NAME = 1
    FW_LDR_IDX_IC_ID = 2
    FW_LDR_IDX_ROM_VER = 3
    FW_LDR_IDX_TRIGGER_REG = 4


'''
fw_ldr_info:
     (
     I prog_mode,
     p fw_ldr_name,
     H ic_id,
     B rom_ver,

	 [(I addr,
	   I val,
	   I no_ack
	  ),
	  ]
	)
'''

fw_ldr_info = [
    # RTL8763B B / C - Cut
    (T_MODE.RAM_PATCH_VENDOR_WRITE_MODE.value,
     "RTL8763B_FW_V1.bin",
     0x8763,
     0x01,
     [(0x10001FB8, 0x10080C01, 1), ]
     ),
    # RTL8763B D - Cut
    (T_MODE.RAM_PATCH_VENDOR_WRITE_MODE.value,
     "RTL8763B_FW_V2.bin",
     0x8763,
     0x03,
     [(0x1000225C, 0x10080C01, 0), ]
     ),
    # RTL8763B E - Cut non - security
    (T_MODE.RAM_PATCH_MODE.value,
     "RTL8763B_FW_V3.bin",
     0x8763,
     0x04,
     [(0x1000228C, 0x10080C01, 0), ]
     ),
    # RTL8763B E - Cut non - security: Vendor Write Enabled
    (T_MODE.RAM_PATCH_VENDOR_WRITE_MODE.value,
     "RTL8763B_FW_V3.bin",
     0x8763,
     0x04,
     [(0x1000228C, 0x10080C01, 0), ]
     ),
    # RTL8763B E - Cut security
    (T_MODE.FLASH_PATCH_MODE.value,
     "boot_patch.bin",
     0x8763,
     0x04,
     [(0x1000228C, 0x10080C01, 0), ]
     ),
    # RTL8763C A - Cut non-security: Vendor Write Enabled
    (T_MODE.RAM_PATCH_VENDOR_WRITE_MODE.value,
     "RTL8763C_FW_V1.bin",
     0x8763C,
     0x04,
     [(0x00202cfc, 0x00308001, 0), ]
     ),
    # End
    (T_MODE.HCI_MODE,
     "End",
     0x0,
     0x0,
     [(0x0, 0x0, 0), ]
     ),
]
def get_mode_name(mode):
    mode_name = "invalid mode"
    if mode == T_MODE.HCI_MODE.value:
        mode_name = "HCI_MODE"
    elif mode == T_MODE.RAM_PATCH_VENDOR_WRITE_MODE.value:
        mode_name = "RAM_PATCH_VENDOR_WRITE_MODE"
    elif mode == T_MODE.FLASH_PATCH_MODE.value:
        mode_name = "FLASH_PATCH_MODE"
    elif mode == T_MODE.RAM_PATCH_MODE.value:
        mode_name = "RAM_PATCH_MODE"
    elif mode == T_MODE.FSBL_PATCH_MODE.value:
        mode_name = "FSBL_PATCH_MODE"
    elif mode == T_MODE.RUN_MP_LOADER_MODE.value:
        mode_name = "RUN_MP_LOADER_MODE"
    else:
        mode_name = "invalid mode (%d)"%mode
    return  mode_name

