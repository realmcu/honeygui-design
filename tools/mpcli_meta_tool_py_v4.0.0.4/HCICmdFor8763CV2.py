from HCICmdProto import *

class HCI_CMD_CODE_FOR_8763C_V2(IntEnum):
    HCI_VENDOR_ENABLE_WDG_RESET_CMD = 0xFC8E
    HCI_VENDOR_READ_EFUSE_ON_RAM = 0xFD62

class WDG_MODE(IntEnum):
    INTERRUPT_CPU = 0          # Interrupt CPU only
    RESET_ALL_EXCEPT_AON = 1   #Reset all except RTC and some AON register
    RESET_CORE_DOMAIN = 2      # Reset core domain
    RESET_ALL = 3              # Reset all

class HCICmdFor8763CV2(HCICmdProto):
    def __init__(self, config, serialHdl):
        super(HCICmdFor8763CV2, self).__init__(config,serialHdl)

    def reboot(self):
        app_euid = 0
        ecc_pub_key = 0
        if self._config.CONFIG_HCI_GET_ECC_PUB_KEY_ENABLE:
            log.stop_log()
            ecc_pub_key = self.__hci_read_ecc_pub_key()
            if type(ecc_pub_key) != bytes:
                LOG_CRITICAL("get ecc pub key in hci mode fail!")
            log.start_log()

        if self._config.CONFIG_HCI_GET_APP_EUID_ENABLE:
            log.stop_log()
            app_euid = self._hci_get_app_euid()
            if type(app_euid) != bytes:
                LOG_CRITICAL("app euid maybe not be burned, get app euid in hci mode fail!")
                app_euid = bytes.fromhex("FFFFFFFF")
            log.start_log()

        if type(app_euid) == bytes and type(ecc_pub_key) == bytes:
            LOG_CRITICAL("DEV_PUB: {}{}{}".format(app_euid.hex(), ecc_pub_key[:32].hex(), ecc_pub_key[32:64].hex()))

        return self.__hci_trigger_wdg_reset()

    def __hci_read_ecc_pub_key(self):
        ECC_PUB_KEY_OFF = 0x28e
        ECC_PUB_KEY_SIZE = 64
        return self.__hci_read_efuse_on_ram(0,ECC_PUB_KEY_OFF,ECC_PUB_KEY_SIZE)

    def __hci_trigger_wdg_reset(self,wdg_mode = WDG_MODE.RESET_ALL.value):
        param_fmt = "<2B"
        param_size = struct.calcsize(param_fmt)
        param_buf = struct.pack(param_fmt,
                                wdg_mode,
                                0xb2)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763C_V2.HCI_VENDOR_ENABLE_WDG_RESET_CMD.value, param_buf,
                                             param_size)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        time.sleep(self._config.CONFIG_HCI_WAIT_FOR_REBOOT_S)
        LOG_CRITICAL("WDG Reset OK!")
        return ERR_OK

    def __hci_read_efuse_on_ram(self,bank,addr,read_size):
        param_fmt = "<BHH"
        len_size = struct.calcsize("<H")
        param_size = struct.calcsize(param_fmt)
        param_buf = struct.pack(param_fmt,bank,addr,read_size)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763C_V2.HCI_VENDOR_READ_EFUSE_ON_RAM.value,
                                             param_buf,
                                             param_size)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt,len(hci_cmd_pkt))

        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        self._serialHdl.set_read_timeout(1)

        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        self._serialHdl.reset_read_timeout()

        if evt_len == 0:
            LOG_ERR("Error: hci event length is 0,read efuse on ram fail!")
            return ERR_HCI_READ_FAIL
        else:
            LOG_DEBUG("hci evt for ecc pub key: {}".format(bytes(hci_evt).hex()))
        if self._hci_evt_pkt_status(hci_evt) != 0:
            LOG_ERR("Error: hci read efuse on ram fail!")
            return ERR_HCI_EVT_STATUS
        else:
            '''
            hci evt = {
            B pkt_type
            B evt_opcode
            B evt_param_len
            B hci_cmd_len
            H hci cmd code
            B status
            H len
            B*len data
            }
            '''
            evt_param_len = hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_LEN.value]
            if evt_param_len < 6:
                LOG_ERR(
                    "Error: hci read efuse on ram payload length is {}".format(evt_param_len))
                return ERR_HCI_EVT_LEN

            cmd_code,st,data_len, = struct.unpack_from("<HBH",bytes(hci_evt),HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_CMD_OPCODE.value)
            if cmd_code != HCI_CMD_CODE_FOR_8763C_V2.HCI_VENDOR_READ_EFUSE_ON_RAM.value:
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE

            if data_len == read_size:
                data_off = HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_BUF.value + len_size
                ecc_pub_key = bytes(hci_evt[data_off : data_off + data_len])
                LOG_DEBUG("ecc_pub_key:{}".format(ecc_pub_key.hex()))
                return ecc_pub_key
            else:
                LOG_ERR("Error: hci read efuse on ram data length mismatch %d -> %d".format(read_size,data_len))
                return ERR_HCI_READ_DATA_SHORT
