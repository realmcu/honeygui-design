import os
from log import *
from err_def import *
from configparser import *
from mp_utility import get_root_path


class CfgParser(object):
    def __init__(self, IC_type):
        configPath = os.path.join(get_root_path(), "config")
        self.IC_type = IC_type

        self.baseConfigIniName = "base_config.ini"
        self.baseConfigIniPath = os.path.join(configPath, self.baseConfigIniName)

        self.customConfigIniName = "custom_config.ini"
        self.customConfigIniPath = os.path.join(configPath, 'chip_configs', self.IC_type, self.customConfigIniName)

        self.config = None
        self.cfgDict = {}

        self.flash_protection_space = []
        self.flash_size = 0
        self.flash_start_addr = 0

        self.img_hdr_size = 0

        self.occd_img_addr = 0
        self.occd_img_size = 0
        self.packet_size = 0

        self._app_cli_baudrate = 0
        self.is_skip_hdr_for_rp = False
        self.use_parallel_cmd = False

    def parse(self):
        self.config = ConfigParser(inline_comment_prefixes=['#', ';'])
        configFileList = [self.baseConfigIniPath, self.customConfigIniPath]
        try:
            readOK = self.config.read(configFileList)
        except Exception as err:
            LOG_ERR(err)
            return ERR_INI_CFG_PARSE_FAIL

        if readOK != configFileList:
            return ERR_INI_CFG_PARSE_FAIL

        return ERR_OK

    def get(self, section, option, default=None):
        try:
            value = self.config.get(section, option, fallback=default)
        except NoOptionError as err:
            LOG_ERR("Error: without option {} under section {}.".format(option, section))
            LOG_ERR(err)
            raise
        except NoSectionError as err:
            LOG_ERR("Error: without section {}.".format(section))
            LOG_ERR(err)
            raise
        except Exception as err:
            LOG_ERR(err)
            raise
        return value

    def getint(self, section, option, default=None):
        try:
            value = self.config.getint(section, option, fallback=default)
        except NoOptionError as err:
            LOG_ERR("Error: without option {} under section {}.".format(option, section))
            LOG_ERR(err)
            raise
        except NoSectionError as err:
            LOG_ERR("Error: without section {}.".format(section))
            LOG_ERR(err)
            raise
        except Exception as err:
            LOG_ERR(err)
            raise
        return value

    def getfloat(self, section, option, default=None):
        try:
            value = self.config.getfloat(section, option, fallback=default)
        except NoOptionError as err:
            LOG_ERR("Error: without option {} under section {}.".format(option, section))
            LOG_ERR(err)
            raise
        except NoSectionError as err:
            LOG_ERR("Error: without section {}.".format(section))
            LOG_ERR(err)
            raise
        except Exception as err:
            LOG_ERR(err)
            raise
        return value

    def getboolean(self, section, option, default=None):
        try:
            value = self.config.getboolean(section, option, fallback=default)
        except NoOptionError as err:
            LOG_ERR("Error: without option {} under section {}.".format(option, section))
            LOG_ERR(err)
            raise
        except NoSectionError as err:
            LOG_ERR("Error: without section {}.".format(section))
            LOG_ERR(err)
            raise
        except Exception as err:
            LOG_ERR(err)
            raise
        return value

    def _get_int_val(self, dataStr):
        data = 0
        try:
            if dataStr[0:2] == "0x" or dataStr[0:2] == "0X":
                data = int(dataStr, 16)
            else:
                data = int(dataStr)
        except ValueError as err:
            LOG_ERR(err)
            raise
        return data

    def get_ic_type(self):
        return self.get("ic_info", "ic_type")

    def set_skip_hdr_for_rp(self, status):
        self.is_skip_hdr_for_rp = status

    def get_skip_hdr_for_rp(self):
        return self.is_skip_hdr_for_rp
    @property
    def IMG_HDR_SIZE(self):
        if self.img_hdr_size == 0:
            hdr_size = self.get("ic_info", "img_hdr_size", "0x1000")
            self.img_hdr_size = self._get_int_val(hdr_size)
        return self.img_hdr_size

    def get_packet_size(self):
        if self.packet_size == 0:
            pkt_size = self.get("packet size", "2w_packet_size", "0x4000")
            self.packet_size = self._get_int_val(pkt_size)
        return self.packet_size

    def set_packet_size(self, pkt_size):
        self.packet_size = pkt_size

    def is_support_enter_hci_through_dbg_board(self):
        return self.getboolean("args config", "enter_hci_through_dbg_board", False)

    def get_occd_img_addr(self):
        if self.occd_img_addr == 0:
            img_addr = self.get("flash setting", "occd_img_addr", "")
            if img_addr != "":
                self.occd_img_addr = self._get_int_val(img_addr)
            else:
                raise Exception(
                    "Error: please set occ_img_addr in flash setting seciton in config file!")
        return self.occd_img_addr
    def set_occd_img_addr(self, occd_img_addr):
        self.occd_img_addr = occd_img_addr

    def get_occd_img_layout_size(self):
        if self.occd_img_size == 0:
            img_size = self.get("flash setting", "occd_img_size", "0x2000")
            self.occd_img_size = self._get_int_val(img_size)
        return self.occd_img_size

    def get_flash_protection_space(self):
        # only support one continuous protection space now
        section = "flash setting"
        flash_protection_blk_cnt_max = int(self.get(section,"flash_protection_block_cnt_max","10").strip(),10)
        flash_non_cache_mask = self.CONFIG_FLASH_ADDR_NON_CACHE

        flash_protection_list = []
        for i in range(flash_protection_blk_cnt_max):
            append_str = "" if i == 0 else "_{}".format(i)
            start_addr =  int(self.get(section,
                                       "flash_protection_start_addr" + append_str,
                                       "0").strip(), 16)
            end_addr = int(self.get(section,
                                    "flash_protection_end_addr" + append_str,
                                    "0").strip(), 16)
            if (start_addr != 0) and \
               (end_addr != 0) and \
               (end_addr > start_addr):
                start_addr |= flash_non_cache_mask
                end_addr |= flash_non_cache_mask
                flash_protection_list.append((start_addr,end_addr))
        return flash_protection_list

    @property
    def CONFIG_SERIAL_DEFAULT_OPEN_BAUDRATE(self):
        return self.getint("uart_property", "default_open_baudrate", 115200)

    @property
    def CONFIG_SERIAL_DEFAULT_MODIFY_BAUDRATE(self):
        return self.getint("uart_property","default_modify_baudrate", 1000000)

    @property
    def CONFIG_SERIAL_READ_TIMEOUT_S(self):
        return self.getint("uart_property", "read_timeout_s", 40)

    @property
    def CONFIG_SERIAL_WRITE_TIMEOUT_S(self):
        return self.getint("uart_property", "write_timeout_s", 30)

    @property
    def CONFIG_SERIAL_INTER_BYTE_TIMEOUT_S(self):
        return self.getint("uart_property", "inter_byte_timeout_s", 10)

    @property
    def CONFIG_FLASH_ADDR_NON_CACHE(self):
        non_cache_mask = self.get("flash setting", "flash_address_non_cache_mask", "")
        if non_cache_mask != "":
            non_cache_mask = int(non_cache_mask, 16)
        else:
            non_cache_mask = 0x0
        return non_cache_mask

    @property
    def CONFIG_FLASH_SIZE_MAX(self):
        if self.flash_size == 0:
            self.flash_size = int(
                self.get("flash setting", "flash_size", "0x400000"), 16)
        return self.flash_size
    def set_flash_size(self,flash_size):
        self.flash_size = flash_size
    @property
    def CONFIG_FLASH_START_ADDR(self):
        if self.flash_start_addr == 0:
            start_addr = self.get("flash setting", "flash_start_address", "0x2000000")
            self.flash_start_addr = int(start_addr, 16) | self.CONFIG_FLASH_ADDR_NON_CACHE

        return self.flash_start_addr
    def set_flash_start_addr(self,flash_start_addr):
        self.flash_start_addr = flash_start_addr
    @property
    def CONFIG_SLEEP_AFTER_DBG_PASSWORD_S(self):
        return self.getfloat("hci delay time", "sleep_after_dbg_password_s", 2)

    @property
    def CONFIG_HCI_WAIT_FOR_FLASH_INIT_S(self):
        return self.getfloat("hci delay time", "wait_for_flash_init_s", 0.01)

    @property
    def CONFIG_HCI_WAIT_FOR_REBOOT_S(self):
        return self.getfloat("hci delay time", "wait_for_reboot_s", 0.5)
    @property
    def CONFIG_WAIT_FOR_APP_RUN_S(self):
        return self.getfloat("hci delay time","wait_for_app_run_s",9)
    @property
    def CONFIG_DBG_BOARD_WAIT_FOR_CONSOLE_S(self):
        return self.getfloat("dbg board sleep time", "dbg_board_wait_for_console_s", 0.02)

    @property
    def CONFIG_WAIT_TO_ENTER_HCI_MODE_S(self):
        return self.getfloat("dbg board sleep time", "wait_to_enter_hci_mode_s", 9)

    @property
    def CONFIG_WAIT_FOR_RAM_PATCH_TRIGGER_S(self):
        return self.getfloat("hci delay time", "wait_for_ram_patch_trigger_s", 0.01)

    @property
    def CONFIG_WAIT_FOR_FW_LOADER_S(self):
        return self.getfloat("hci delay time", "wait_for_fw_loader_s", 0.2)

    @property
    def CONFIG_READ_RETRY_MAX_TIMES(self):
        return self.getint("retry_times", "read_retry_times_max", 10)

    @property
    def CONFIG_ERASE_RETRY_MAX_TIMES(self):
        return self.getint("retry_times", "erase_retry_times_max", 10)

    @property
    def CONFIG_PROGRAM_RETRY_MAX_TIMES(self):
        return self.getint("retry_times", "program_retry_times_max", 10)

    @property
    def CONFIG_VERIFY_RETRY_MAX_TIMES(self):
        return self.getint("retry_times", "verify_retry_times_max", 10)

    @property
    def CONFIG_LOAD_RAM_PATCH_RETRY_MAX_TIMES(self):
        return self.getint("retry_times", "load_ram_patch_retry_max_times", 10)

    @property
    def CONFIG_SET_BAUDRATE_TIMEOUT_S(self):
        return self.getfloat("data uart timeout", "set_baudrate_timeout_s", 1)

    @property
    def CONFIG_FSBL_CON_READ_TIMEOUT_S(self):
        return self.getfloat("data uart timeout", "fsbl_con_read_timeout_ms", 200)

    @property
    def CONFIG_FSBL_CON_DELAY_PER_CYCLE_MS(self):
        return self.getfloat("data uart timeout", "fsbl_con_delay_per_cycle_ms", 100)

    @property
    def CONFIG_WAIT_FOR_CONNECT_FSBL_S(self):
        return self.getfloat("data uart timeout", "wait_for_connecting_fsbl_s", 80)
    @property
    def CONFIG_WAIT_FOR_LOAD_RAM_PATCH_S(self):
        return self.getfloat("data uart timeout","wait_for_load_rp_s",0.01)

    @property
    def CONFIG_WAIT_FOR_BAUDRATE_CHANGE_S(self):
        return self.getfloat("uart_property", "wait_for_baudrate_change_s", 0.01)

    @property
    def CONFIG_TWO_WIRE_UART_PKT_SIZE(self):
        pkt_size = self.get("packet size", "2w_packet_size", "0x4000")
        pkt_size = self._get_int_val(pkt_size)
        return pkt_size

    @property
    def CONFIG_SINGLE_WIRE_UART_PKT_SIZE(self):
        pkt_size = self.get("packet size", "1w_packet_size", "0x1000")
        pkt_size = self._get_int_val(pkt_size)
        return pkt_size

    @property
    def CONFIG_LOAD_RAM_PATCH_PKT_SIZE(self):
        pkt_size = self.get("packet size", "load_ram_patch_pkt_size", "1024")
        pkt_size = self._get_int_val(pkt_size)
        return pkt_size

    @property
    def CONFIG_APP_CLI_UART_BAUDRATE(self):
        if self._app_cli_baudrate == 0:
            self._app_cli_baudrate = self.getint("app cli", "app_cli_uart_baudrate",
                                                 2000000)
        return self._app_cli_baudrate
    @property
    def CONFIG_DETECT_APP_STATE_TIME_S(self):
        return self.getfloat("app cli","detect_app_state_time_s",15)
    @property
    def CONFIG_WAIT_FOR_ENTER_CONSOLE_S(self):
        return self.getfloat("app cli","wait_for_enter_console_s",0.01)

    @property
    def CONFIG_CLI_READ_TIMEOUT_MS(self):
        return self.getfloat("app cli", "cli_read_timeout_ms", 200)

    @property
    def CONFIG_MP_LOADER_LOG_ENABLE(self):
        log_enable_status = self.get("handshake setting", "log_enable", "0xFF")
        log_enable = self._get_int_val(log_enable_status)
        return log_enable

    @property
    def CONFIG_HANDSHAKE_READ_TIMEOUT_MS(self):
        return self.getfloat("handshake setting", "read_timeout_ms", 10)

    @property
    def CONFIG_HANDSHAKE_TIMEOUT_S(self):
        return self.getfloat("handshake setting", "handshake_timeout_s", 300)

    @property
    def CONFIG_IS_REBOOT_BEFORE_HANDSHAKE(self):
        return self.getboolean("handshake setting", "is_reboot", False)
    @property
    def CONFIG_REBOOT_TYPE_FOR_HANDSHAKE(self):
        return self.getint("handshake setting", "reboot_type", 0)

    @property
    def CONFIG_SPIC_SELECT_NUMBER(self):
        return self.getint("spic select", "spic_select_number", 0)
    @property
    def CONFIG_SPIC_SELECT_TRY_CNT_MAX(self):
        return self.getint("spic select","spic_select_try_times_max",10)

    @property
    def CONFIG_FACTORY_MP_LOADER_ADDRESS(self):
        address = self.get("factory mp loader","boot_patch_address","0x804000")
        flash_address = self._get_int_val(address)
        flash_address |= self.CONFIG_FLASH_ADDR_NON_CACHE
        return flash_address
    @property
    def CONFIG_FACTORY_MP_LOADER_IMAGE(self):
        return self.get("factory mp loader","boot_patch_image","boot_patch_new.bin")
    @property
    def CONFIG_SECURE_DEVICE_ON_PRODUCTION(self):
        return self.getboolean("factory mp loader","disable_load_factory_mp",True)

    @property
    def CONFIG_AUTO_DETECT_SUPPORT_FLAG(self):
        return self.getboolean("auto detect mode","enable",True)

    @property
    def CONFIG_HCI_GET_APP_EUID_ENABLE(self):
        return self.getboolean("get app euid","hci_get_app_euid",False)
    @property
    def CONFIG_HCI_GET_ECC_PUB_KEY_ENABLE(self):
        return self.getboolean("get app euid","hci_get_ecc_pub_key",False)
    @property
    def CONFIG_UPDATE_RAM_PATCH_ENABLE(self):
        return self.getboolean("update ram patch","enable",False)

    @property
    def CONFIG_UPDATE_RAM_PATCH_PATH(self):
        return self.get("update ram patch","ram_path","RTL8763C_V2_ram_patch.bin")
    @property
    def CONFIG_USE_PARALLEL_CMD(self):
        return self.getboolean("flash setting","use_parallel_cmd",False)
