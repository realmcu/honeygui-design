from enum import IntEnum

FLASH_NOR_RET_SUCCESS = 24

class FLASH_IOCTL_CODE(IntEnum):
    flash_ioctl_mass_erase = 0x0
    flash_ioctl_get_page_size = 1
    flash_ioctl_get_start_addr_main = 2
    flash_ioctl_get_size_main = 3
    flash_ioctl_get_flash_otp_offset = 4
    flash_ioctl_get_curr_bit_mode = 5
    flash_ioctl_get_rdid = 6
    flash_ioctl_get_wait_busy_ctr = 7

    flash_ioctl_set_base = 0x1000
    flash_ioctl_set_otp_cfg = 0x1001

    flash_ioctl_set_sw_protect = 0x1002
    flash_ioctl_set_tb_bit = 0x1003
    flash_ioctl_set_deep_power_down = 0x1004
    flash_ioctl_set_sw_protect_unlock_by_addr = 0x1005
    flash_ioctl_set_baudrate_clk_div = 0x1006
    flash_ioctl_set_log_bitmap = 0x1007
    flash_ioctl_set_pa33_delay = 0x1008

    flash_ioctl_dump_base = 0x2000
    flash_ioctl_dump_cfg = 0x2001
    flash_ioctl_dump_sw_protect_info = 0x2002
    flash_ioctl_dump_top_bottom_info = 0x2003

    flash_ioctl_exec_base = 0x3000
    flash_ioctl_exec_load_cfg = 0x3001
    flash_ioctl_exec_bp_dp_test = 0x3002  # execute BlockProtect & DeepPowerdown test
    flash_ioctl_exec_dp_test = 0x3003
    flash_ioctl_exec_bit_mode_switch = 0x3004
    flash_ioctl_exec_flash_sw_reset = 0x3005
    flash_ioctl_exec_ft_test = 0x3006
    flash_ioctl_exec_ext_flash_ft_test = 0x3007
    flash_ioctl_exec_high_speed_read_test = 0x3008
    flash_ioctl_exec_wdg_reset = 0x3009
    flash_ioctl_exec_flash_clock_switch_test = 0x300A
    flash_ioctl_exec_flash_init = 0x300B
    flash_ioctl_exec_running_test = 0x300C
    flash_ioctl_exec_flash_erase = 0x300D
    flash_ioctl_exec_if_switch = 0x300E

class FLASH_NOR_IOCTL_TYPE(IntEnum):
    FLASH_NOR_GET_BASE             = 0x0000
    FLASH_NOR_GET_ADDR_BASE        = 0x0001
    FLASH_NOR_GET_RDID             = 0x0002
    FLASH_NOR_GET_SIZE             = 0x0003
    FLASH_NOR_GET_BP               = 0x0004
    FLASH_NOR_GET_BP_TOP_BOTTOM    = 0x0005
    FLASH_NOR_GET_WAIT_BUSY_CTR    = 0x0006
    FLASH_NOR_GET_BIT_MODE         = 0x0007

    FLASH_NOR_SET_BASE             = 0x1000
    FLASH_NOR_SET_BP               = 0x1001
    FLASH_NOR_SET_BP_TOP_BOTTOM    = 0x1002
    FLASH_NOR_SET_BP_UNLOCK_BY_ADDR= 0x1003
    FLASH_NOR_SET_WAIT_BUSY_CTR    = 0x1004
    FLASH_NOR_SET_SPIC_BAUD        = 0x1005
    FLASH_NOR_SET_LOG_BITMAP       = 0x1006

    FLASH_NOR_EXEC_BASE            = 0x2000
    FLASH_NOR_EXEC_FLASH_INIT      = 0x2001
    FLASH_NOR_EXEC_DP              = 0x2002
    FLASH_NOR_EXEC_FLASH_SW_RESET  = 0x2003
    FLASH_NOR_EXEC_QUERY_INFO_LOADING= 0x2004
    FLASH_NOR_EXEC_HIGH_SPEED_MODE = 0x2005
    FLASH_NOR_EXEC_FLASH_CAL       = 0x2006
    #FLASH_NOR_EXEC_FLASH_READ      = 0x2007
    FLASH_NOR_EXEC_FLASH_WRITE     = 0x2008
    FLASH_NOR_EXEC_FLASH_ERASE     = 0x2009

    FLASH_NOR_BASE_MASK            = 0xF000
