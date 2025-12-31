from HCICmdProto import *
from flash_ioctl_code_def import FLASH_NOR_IOCTL_TYPE

class HCI_CMD_CODE_FOR_8763D(IntEnum):
    HCI_VENDOR_ENABLE_WDG_RESET_CMD = 0xFC8E
    HCI_VENDOR_READ_EFUSE_ON_RAM = 0xFD62

    HCI_VENDOR_FLASH_NOR_READ = 0xFC29
    HCI_VENDOR_FLASH_NOR_WRITE = 0xFC2A
    HCI_VENDOR_FLASH_NOR_ERASE = 0xFC2B
    HCI_VENDOR_FLASH_NOR_IOCTL = 0xFC2C
class FLASH_NOR_ERASE_MODE(IntEnum):
    FLASH_NOR_ERASE_SECTOR  = 1
    FLASH_NOR_ERASE_BLOCK   = 2
    FLASH_NOR_ERASE_CHIP    = 4

class WDG_MODE(IntEnum):
    INTERRUPT_CPU = 0          # Interrupt CPU only
    RESET_ALL_EXCEPT_AON = 1   #Reset all except RTC and some AON register
    RESET_CORE_DOMAIN = 2      # Reset core domain
    RESET_ALL = 3              # Reset all

class HCICmdFor8763D(HCICmdProto):
    def __init__(self, config, serialHdl):
        super(HCICmdFor8763D, self).__init__(config,serialHdl)

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
    def load_fw(self):
        retCode = self.__hci_flash_init()
        if retCode == ERR_OK:
            time.sleep(self._config.CONFIG_HCI_WAIT_FOR_FLASH_INIT_S)
            return self.__hci_flash_unlock()
        else:
            return retCode
    def read(self, addr, rd_size, saveObj):
        if saveObj == None:
            return ERR_SAVE_OBJ_NONE
        if type(saveObj) == list:
            return self.__hci_read_into_buf(addr, rd_size, saveObj)
        elif type(saveObj) == str:
            return self.__hci_read_as_file(addr, rd_size, saveObj)
        else:
            raise Exception("Error: Don't support saveobj type {}".format(type(saveObj)))
    def program(self, dl_obj, addr, data_size):
        if dl_obj == None:
            return ERR_PROGRAM_OBJ_NONE

        if type(dl_obj) == list:
            return self.__hci_program_data(addr, data_size, dl_obj)
        elif type(dl_obj) == str:
            return self.__hci_program_file(dl_obj, addr, data_size)
        else:
            raise Exception(
                "Error: don't support to program object type {}!".format(type(dl_obj)))
    def  flash_lock(self):
        flash_rdid = self._hci_get_rdid()
        if flash_rdid < 0:
            return flash_rdid
        else:
            device_id = flash_rdid&0xFFFF
            manu_id = (flash_rdid&0xFFFF0000)>>16
            if flash_rdid_query_tbl.__contains__(manu_id):
                if flash_rdid_query_tbl[manu_id].__contains__(device_id):
                    bp_all_lv = flash_rdid_query_tbl[manu_id][device_id]
                else:
                    LOG_ERR("Error: flash manu_id 0x%x not support device_id 0x%x"%(manu_id,device_id))
                    return ERR_FLASH_RDID_NOT_SUPPORTED
            else:
                LOG_ERR("Error: don't support flash vendor manu_id 0x%x!" % (manu_id))
                return ERR_FLASH_RDID_NOT_SUPPORTED

        flash_set_tb_bit_rst = self.__hci_flash_ioctl(FLASH_NOR_IOCTL_TYPE.FLASH_NOR_SET_BP_TOP_BOTTOM.value,param1=0x01)
        if flash_set_tb_bit_rst != 0:
            LOG_ERR("Error: flash ioctl set tb bit fail!")
            return flash_set_tb_bit_rst

        flash_set_sw_protect_rst = self.__hci_flash_ioctl(FLASH_NOR_IOCTL_TYPE.FLASH_NOR_SET_BP.value,param1=bp_all_lv-1)
        if flash_set_sw_protect_rst != 0:
            LOG_ERR("Error: flash ioctl lock flash fail!")
            return flash_set_sw_protect_rst
        else:
            LOG_CRITICAL("flash lock ok!")

        return ERR_OK
    def __hci_flash_unlock(self):
        flash_set_sw_protect_rst = self.__hci_flash_ioctl(
            FLASH_NOR_IOCTL_TYPE.FLASH_NOR_SET_BP.value)
        if flash_set_sw_protect_rst != 0:
            LOG_ERR("Error: flash ioctl set sw protect fail!")
            return ERR_HCI_FLASH_UNLOCK_FAIL
        return ERR_OK
    def __hci_flash_ioctl(self, flash_ioctl_opcode,flash_idx = 0x0,param1 = 0x0, param2 = 0x0, param3 = 0x0):
        '''' OP(2B) | Len(1B) | Cmd(2B) | FlashIdx(2B) | Param1(4B) | Param2(4B) |Param3(4B)'''
        param_buf = struct.pack("<HH3I", flash_ioctl_opcode, flash_idx, param1, param2, param3)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_IOCTL.value, param_buf,
                                             len(param_buf))

        self._serialHdl.set_read_timeout(0.3)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        if evt_len == 0:
            LOG_ERR("Error: rev hci evt pkt fail in hci flash init procedure!")
            return ERR_HCI_READ_FAIL

        self._serialHdl.reset_read_timeout()
        if self._hci_evt_pkt_status(hci_evt) != 0:
            LOG_ERR("Error: hci flash init fail!")
            return ERR_HCI_EVT_STATUS
        return ERR_OK
    def verify(self, img_path, img_addr):
        skip_offset = 0

        try:
            mp_hdr_exist = image_parser_singleton.is_with_mp_hdr(img_path)
            if mp_hdr_exist == True:
                skip_offset = MP_HEADER_SIZE
            elif mp_hdr_exist == False:
                skip_offset = 0
        except Exception as err:
            LOG_ERR(err)
            return ERR_IMG_PARSE_FAIL

        img_content_size = image_parser_singleton.image_dl_content_size

        crc16_init = 0
        try:
            with open(img_path, 'rb') as fp:
                fp.seek(skip_offset)
                crc16_orgfile = CRC().calc_file_crc(crc16_init, fp, img_content_size)
                fp.close()

                verify_ret = self.__hci_verify(img_addr, img_content_size, crc16_orgfile)
                if verify_ret != ERR_OK:
                    LOG_ERR("Error: flash verify fail. address 0x%08X, size 0x%08X." % (
                        img_addr, img_content_size))
                    return verify_ret
                else:
                    return ERR_OK

        except:
            LOG_ERR("Error: fail to do flash verify for %s." % img_path)
            raise
    def __hci_flash_init(self):
        flash_init_rst = self.__hci_flash_ioctl(
            FLASH_NOR_IOCTL_TYPE.FLASH_NOR_EXEC_FLASH_INIT.value)
        if flash_init_rst != 0:
            LOG_ERR("Error:flash ioctl exec flash init fail!")
            return ERR_HCI_FLASH_INIT_FAIL

        flash_load_cfg_rst = self.__hci_flash_ioctl(
            FLASH_NOR_IOCTL_TYPE.FLASH_NOR_EXEC_QUERY_INFO_LOADING.value)
        if flash_load_cfg_rst != 0:
            LOG_ERR("Error:flash ioctl exec load cfg fail!")
            return ERR_HCI_FLASH_LOAD_CFG_FAIL

        return ERR_OK
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
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763D.HCI_VENDOR_ENABLE_WDG_RESET_CMD.value, param_buf,
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
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763D.HCI_VENDOR_READ_EFUSE_ON_RAM.value,
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
            if cmd_code != HCI_CMD_CODE_FOR_8763D.HCI_VENDOR_READ_EFUSE_ON_RAM.value:
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE

            if data_len == read_size:
                data_off = HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_BUF.value + len_size
                ecc_pub_key = bytes(hci_evt[data_off : data_off + data_len])
                LOG_DEBUG("ecc_pub_key:{}".format(ecc_pub_key.hex()))
                return ecc_pub_key
            else:
                LOG_ERR("Error: hci read efuse on ram data length mismatch %d -> %d".format(read_size,data_len))
                return ERR_HCI_READ_DATA_SHORT
    def __hci_read_as_file(self, addr, rd_size, save_file):
        '''
         read data on flash specified address, and save as binary file
        :param addr: read flash address
        :param rdSize: read buffer size
        :param saveFile: save file path
        :return: 0 ok, others: errcode
        '''

        LOG_DEBUG("start CMD: savebin 0x%08x 0x%x %s" % (addr, rd_size, save_file))

        try:
            fp = open(save_file, 'wb+')
        except IOError as err:
            LOG_ERR("Error: open save file %s fail." % save_file)
            LOG_ERR(err)
            return ERR_FILE_OPEN_FAIL

        PER_READ_SIZE = self._config.get_packet_size()
        pkt_num = rd_size // PER_READ_SIZE
        remain = rd_size % PER_READ_SIZE
        if remain != 0:
            pkt_num += 1

        if rd_size >= 0x40000:
            LOG_CRITICAL("please wait for reading flash data ......")

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to read address 0x%x size 0x%x" % (addr, rd_size))

        for pkt_idx in range(pkt_num):
            if pkt_idx != pkt_num - 1:
                pkt_size = PER_READ_SIZE
            else:
                if remain != 0:
                    pkt_size = remain
                else:
                    pkt_size = PER_READ_SIZE

            rd_addr = addr + pkt_idx * PER_READ_SIZE

            read_buf = []
            if self.__hci_read_into_buf(rd_addr, pkt_size, read_buf) == 0:
                fp.write(bytearray(read_buf))
                fp.flush()

                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                            pkt_idx + 1, pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
                LOG_DEBUG("    read 0x%08x len 0x%x ok" % (rd_addr, pkt_size))

            else:
                LOG_ERR("Error:flash read 0x%08x size 0x%x fail." % (rd_addr, pkt_size))
                return ERR_HCI_READ_FAIL
        fp.close()

        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                    pkt_idx + 1, pkt_num, (pkt_idx + 1) / pkt_num))
        LOG_DEBUG("save bin %s" % os.path.realpath(save_file))
        return ERR_OK

    def __hci_read_into_buf(self, addr, rd_size, readBuf=None):
        if readBuf == None:
            readBuf = []

        EVT_PKT_TYPE_SIZE = 1
        EVT_PKT_EVT_CMD_SIZE = 1
        EVT_PKT_PARAM_LEN_SIZE = 1
        EVT_OPCODE_LEN_SIZE = 1
        EVT_OPCODE_SIZE = 2
        EVT_STATUS_SIZE = 1

        EVT_PARAM_FIXED_SIZE = EVT_OPCODE_LEN_SIZE + \
                               EVT_OPCODE_SIZE + \
                               EVT_STATUS_SIZE

        RD_DATA_OFFSET_IN_EVT = EVT_PKT_TYPE_SIZE + \
                                EVT_PKT_EVT_CMD_SIZE + \
                                EVT_PKT_PARAM_LEN_SIZE + \
                                EVT_PARAM_FIXED_SIZE
        READ_WRITE_MAX_BYTE_NUM = 244
        total_read_len = 0
        addr2 = addr // 4 * 4
        len2 = (addr - addr2 + rd_size + 3) // 4 * 4
        pkt_num = len2 // READ_WRITE_MAX_BYTE_NUM
        if len2 % READ_WRITE_MAX_BYTE_NUM != 0:
            pkt_num += 1

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to read address 0x%x size 0x%x" % (addr, rd_size))

        for pkt_idx in range(pkt_num):
            pkt_len = 0
            read_len = 0
            offset = 0
            if pkt_idx == 0:
                if pkt_idx != pkt_num - 1:
                    pkt_len = READ_WRITE_MAX_BYTE_NUM
                    offset = addr - addr2
                    read_len = pkt_len - offset
                    total_read_len += read_len
                else:
                    pkt_len = len2
                    offset = addr - addr2
                    read_len = rd_size
                    total_read_len += read_len
            elif pkt_idx == pkt_num - 1:
                pkt_len = len2 - pkt_idx * READ_WRITE_MAX_BYTE_NUM
                offset = 0
                read_len = rd_size - total_read_len
                total_read_len += read_len
            else:
                pkt_len = READ_WRITE_MAX_BYTE_NUM
                read_len = READ_WRITE_MAX_BYTE_NUM
                offset = 0
                total_read_len += read_len

            rd_addr = addr2 + pkt_idx * READ_WRITE_MAX_BYTE_NUM

            ''' | OP(2B) | Len(1B) | RDAddr(4B) | RDLen(4B) |'''
            param_buf = struct.pack("<2I", rd_addr, pkt_len)

            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763D.HCI_VENDOR_FLASH_NOR_READ.value,
                                                 param_buf, len(param_buf))

            written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
            if written_len != len(hci_cmd_pkt):
                return ERR_HCI_SEND_DATA_FAIL

            hci_evt = []
            evt_len = self._hci_evt_pkt_recv(hci_evt)

            if evt_len == 0:
                LOG_ERR("Error: rev hci evt pkt fail in hci flash read buffer procedure!")
                return ERR_HCI_READ_FAIL

            if self._hci_evt_pkt_status(hci_evt) != 0:
                LOG_ERR("Error: hci flash read %d bytes from 0x%08X fail!" % (
                    pkt_len, rd_addr))
                return ERR_HCI_EVT_STATUS
            else:
                evt_param_len = hci_evt[2]
                evt_rd_len = evt_param_len - EVT_PARAM_FIXED_SIZE

                if pkt_len != evt_rd_len:
                    LOG_ERR(
                        "Error: flash read buffer request %d bytes,but read %d bytes!" % (
                            pkt_len, evt_rd_len))
                    return ERR_HCI_READ_DATA_SHORT

                readBuf += list(hci_evt[(RD_DATA_OFFSET_IN_EVT + offset):(
                        RD_DATA_OFFSET_IN_EVT + offset + read_len)])

                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                            pkt_idx + 1, pkt_num, percent))

                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                    pkt_idx + 1, pkt_num, (pkt_idx + 1) / pkt_num))
        return ERR_OK

    def __hci_program_file(self, img_path, img_addr, img_content_size):
        file_size = os.path.getsize(img_path)
        LOG_DEBUG("file size: %d,  payload length: %d" % (file_size, img_content_size))

        skip_offset = 0

        try:
            mp_hdr_exist = image_parser_singleton.is_with_mp_hdr(img_path)

            if mp_hdr_exist == True:
                skip_offset = MP_HEADER_SIZE
            elif mp_hdr_exist == False:
                skip_offset = 0
        except Exception as err:
            LOG_CRITICAL(err)
            return ERR_IMG_PARSE_FAIL

        try:
            with open(img_path, 'rb') as fp:
                fp.seek(skip_offset)

                program_ret = self.__hci_program_fp(img_addr, img_content_size, fp)
                if program_ret != ERR_OK:
                    LOG_ERR("Error: fail to program %s on address 0x%08X size 0x%x." % (
                        img_path, img_addr, img_content_size))
                    fp.close()
                    return program_ret
                else:
                    fp.close()
                    return ERR_OK
        except:
            LOG_ERR("Error: fail to open %s." % img_path)
            return ERR_FILE_OPEN_FAIL

    def __hci_program_fp(self, addr, data_len, fp):
        addr2 = addr // 4 * 4
        len2 = (addr - addr2 + data_len + 3) // 4 * 4

        program_buf = []
        if addr != addr2:
            pre_buf = []
            rd_ret = self.__hci_read_into_buf(addr2, addr - addr2, pre_buf)
            if rd_ret != ERR_OK:
                LOG_ERR("Error: hci read 0x%08X len %d fail." % (addr2, addr - addr2))
                return rd_ret
            else:
                program_buf += pre_buf

        data_buf = list(fp.read())
        program_buf += data_buf
        if len2 != (addr - addr2 + data_len):
            post_buf = []
            rd_ret = self.__hci_read_into_buf(addr + data_len,
                                              len2 - (addr - addr2) - data_len,
                                              post_buf)
            if rd_ret != ERR_OK:
                LOG_ERR("Error: hci read 0x%08X len %d bytes fail." % (
                    (addr + data_len), (len2 - (addr - addr2) - data_len)))
                return rd_ret
            else:
                program_buf += post_buf

        addr = addr2
        data_len = len2

        READ_WRITE_MAX_BYTE_NUM = 244
        pkt_num = data_len // READ_WRITE_MAX_BYTE_NUM
        if data_len % READ_WRITE_MAX_BYTE_NUM != 0:
            pkt_num += 1

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to program address 0x%x size 0x%x" % (addr, data_len))

        for pkt_idx in range(pkt_num):
            if pkt_idx == (pkt_num - 1):
                pkt_len = data_len - pkt_idx * READ_WRITE_MAX_BYTE_NUM
            else:
                pkt_len = READ_WRITE_MAX_BYTE_NUM
            LOG_CRITICAL("pkt idx {}".format(pkt_idx))
            param_fmt = "<II%dB" % pkt_len
            param_size = struct.calcsize(param_fmt)

            param_buf = list(struct.pack(param_fmt,
                                         (addr + pkt_idx * READ_WRITE_MAX_BYTE_NUM),
                                         pkt_len,
                                         *program_buf[
                                          (pkt_idx * READ_WRITE_MAX_BYTE_NUM):(
                                                  pkt_idx * READ_WRITE_MAX_BYTE_NUM + pkt_len)]))

            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763D.HCI_VENDOR_FLASH_NOR_WRITE.value,
                                                 param_buf,
                                                 param_size)

            written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
            if written_len != len(hci_cmd_pkt):
                return ERR_HCI_SEND_DATA_FAIL

            hci_evt = []
            evt_len = self._hci_evt_pkt_recv(hci_evt)
            if evt_len == 0:
                LOG_ERR("Error: rev hci evt pkt fail in hci program procedure!")
                return ERR_HCI_READ_FAIL

            if self._hci_evt_pkt_status(hci_evt) != 0:
                LOG_ERR("Error: write %d bytes to 0x%08X fail!" % (
                    pkt_len, addr + pkt_idx * READ_WRITE_MAX_BYTE_NUM))
                return ERR_HCI_EVT_STATUS
            else:
                LOG_DEBUG("    download packet %d/%d ok" % (pkt_idx + 1, pkt_num))
                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG("\tprogram progress {}/{} {:.1%} ".format(
                            pkt_idx + 1, pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
                continue
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG("\tprogram progress {}/{} {:.1%} ".format(
                    pkt_idx + 1, pkt_num, (pkt_idx + 1) / pkt_num))
        return ERR_OK

    def __hci_program_data(self, addr, data_len, data_buf):
        addr2 = addr // 4 * 4
        len2 = (addr - addr2 + data_len + 3) // 4 * 4

        program_buf = []
        if addr != addr2:
            pre_buf = []
            rd_ret = self.__hci_read_into_buf(addr2, addr - addr2, pre_buf)
            if rd_ret != ERR_OK:
                LOG_ERR(
                    "Error: hci read 0x%08X len %d bytes fail." % (addr2, addr - addr2))
                return rd_ret
            else:
                program_buf += pre_buf

        program_buf += data_buf

        if len2 != (addr - addr2 + data_len):
            post_buf = []
            rd_ret = self.__hci_read_into_buf(addr + data_len,
                                              len2 - (addr - addr2) - data_len,
                                              post_buf)
            if rd_ret != ERR_OK:
                LOG_ERR("Error: hci read 0x%08X len %d bytes fail." % (
                    (addr + data_len), (len2 - (addr - addr2) - data_len)))
                return rd_ret

            program_buf += post_buf

        addr = addr2
        data_len = len2

        READ_WRITE_MAX_BYTE_NUM = 244
        pkt_num = data_len // READ_WRITE_MAX_BYTE_NUM
        if data_len % READ_WRITE_MAX_BYTE_NUM != 0:
            pkt_num += 1

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to program address 0x%x size 0x%x" % (addr, data_len))

        for pkt_idx in range(pkt_num):
            if pkt_idx == (pkt_num - 1):
                pkt_len = data_len - pkt_idx * READ_WRITE_MAX_BYTE_NUM
            else:
                pkt_len = READ_WRITE_MAX_BYTE_NUM

            param_fmt = "<II%dB" % pkt_len
            param_size = struct.calcsize(param_fmt)
            param_buf = list(struct.pack(param_fmt,
                                         (addr + pkt_idx * READ_WRITE_MAX_BYTE_NUM),
                                         pkt_len,
                                         *program_buf[
                                          (pkt_idx * READ_WRITE_MAX_BYTE_NUM):(
                                                  pkt_idx * READ_WRITE_MAX_BYTE_NUM + pkt_len)]))
            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763D.HCI_VENDOR_FLASH_NOR_WRITE.value,
                                                 param_buf,
                                                 param_size)

            written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
            if written_len != len(hci_cmd_pkt):
                return ERR_HCI_SEND_DATA_FAIL

            hci_evt = []
            evt_len = self._hci_evt_pkt_recv(hci_evt)
            if evt_len == 0:
                LOG_ERR("Error: rev hci evt pkt fail in hci program procedure!")
                return ERR_HCI_READ_FAIL

            if self._hci_evt_pkt_status(hci_evt) != 0:
                LOG_ERR("Error: write %d bytes to 0x%08X fail!" % (
                    pkt_len, addr + pkt_idx * READ_WRITE_MAX_BYTE_NUM))
                return ERR_HCI_EVT_STATUS
            else:
                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG(
                            "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1,
                                                                      pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
                continue
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG(
                    "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
                                                              (pkt_idx + 1) / pkt_num))
        return ERR_OK

    def __hci_verify(self, addr, data_len, data_buf):
        flash_data = []

        rd_ret = self.__hci_read_into_buf(addr, data_len, flash_data)
        if rd_ret != 0:
            LOG_ERR("Error: hci read fail in hci verify procedure!")
            return rd_ret
        else:
            crc16_init = 0
            crc16_flash = CRC().btxfcs(crc16_init, flash_data)
            if data_buf == crc16_flash:
                return ERR_OK
            else:
                return ERR_HCI_VERIFY_CRC_FAIL
    def page_erase(self, addr, size):
        EFLASH_PAGE_SIZE = 0x1000  # 4KB flash page size
        total_page_cnt = size // EFLASH_PAGE_SIZE

        if size % EFLASH_PAGE_SIZE != 0:
            total_page_cnt += 1

        LOG_DEBUG("    total erase page count %d" % total_page_cnt)
        PRINT_PERCENT = False
        if total_page_cnt >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to erase address 0x%x size 0x%x" % (addr, size))
        '''
        erase address(4B) + erase type(1B)
        #erase type:     
             FLASH_NOR_ERASE_SECTOR  = 1,
             FLASH_NOR_ERASE_BLOCK   = 2,
            FLASH_NOR_ERASE_CHIP    = 4,
        '''
        param_fmt = "<IB"
        param_buf_size = struct.calcsize(param_fmt)
        for page_idx in range(total_page_cnt):
            erase_addr = addr + page_idx * EFLASH_PAGE_SIZE
            param_buf = list(struct.pack(param_fmt, erase_addr,FLASH_NOR_ERASE_MODE.FLASH_NOR_ERASE_SECTOR.value))

            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE_FOR_8763D.HCI_VENDOR_FLASH_NOR_ERASE.value,
                                                 param_buf, param_buf_size)
            written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
            if written_len != len(hci_cmd_pkt):
                return ERR_HCI_SEND_DATA_FAIL

            hci_evt = []
            evt_len = self._hci_evt_pkt_recv(hci_evt)
            if evt_len == 0:
                LOG_ERR("Error: rev hci evt pkt fail in hci page erase procedure!")
                return ERR_HCI_READ_FAIL

            if self._hci_evt_pkt_status(hci_evt) != 0:
                LOG_ERR("Error: hci page erase at 0x%08X fail!" % erase_addr)
                return ERR_HCI_EVT_STATUS
            else:
                LOG_DEBUG("    erase page %d/%d" % (page_idx + 1, total_page_cnt))
                # time.sleep(CONFIG_HCI_WAIT_FOR_ERASE_S)
                if PRINT_PERCENT:
                    if (page_idx + 1) % (int(total_page_cnt * 0.1)) == 0:
                        percent = (page_idx + 1) / total_page_cnt
                        LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                            page_idx + 1, total_page_cnt, percent))

                        if page_idx + 1 == total_page_cnt:
                            PRINT_PERCENT = False
        if PRINT_PERCENT:
            if page_idx + 1 == total_page_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                    page_idx + 1, total_page_cnt, (page_idx + 1) / total_page_cnt))
        return ERR_OK
    def _hci_get_rdid(self):
        param_fmt = "<3I"
        param_size = struct.calcsize(param_fmt)
        param_buf = struct.pack(param_fmt,
                                FLASH_NOR_IOCTL_TYPE.FLASH_NOR_GET_RDID.value,
                                0,
                                0)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_IOCTL.value, param_buf,
                                             param_size)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        if evt_len == 0:
            LOG_ERR("Error: hci event length is 0,get rdid fail!")
            return ERR_HCI_READ_FAIL

        self._serialHdl.reset_read_timeout()
        if self._hci_evt_pkt_status(hci_evt) != 0:
            LOG_ERR("Error: hci get rdid fail!")
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
            B param[4]
            B param[5]
            B param[6]  rdid = param[4]+(param[5]<<8) + (param[6]<<16)
            }
            '''
            evt_param_len = hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_LEN.value]
            if evt_param_len != 8:
                LOG_ERR(
                    "Error: hci get rdid response payload length is {}, expected 8".format(
                        evt_param_len))
                return ERR_HCI_EVT_LEN
            flash_rdid = hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_BUF] + \
                       (hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_BUF + 1] << 8) + \
                       (hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_BUF + 2] << 16)
            LOG_CRITICAL("get rdid 0x%x" % flash_rdid)
            return flash_rdid