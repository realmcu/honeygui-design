import time
import sys
import operator
from HCIInterface import *
from mp_utility import *
from crc import CRC
from image_parser import *
from mp_base_def import *
from flash_ioctl_code_def import FLASH_IOCTL_CODE

class HCI_CMD_CODE(IntEnum):
    HCI_READ_VERSION = 0x1001
    HCI_VENDOR_SET_BAUDRATE_CMD = 0xFC17
    HCI_VENDOR_DOWNLOAD = 0xFC20
    HCI_FLASH_READ_BUFFER = 0xFC2D
    HCI_FLASH_WRITE_BUFFER = 0xFC2E
    HCI_FLASH_PAGE_ERASE = 0xFC2B
    HCI_FLASH_IOCTL = 0xFC2C
    HCI_VENDOR_READ = 0xFC61
    HCI_VENDOR_WRITE = 0xFC62

    HCI_VENDOR_READ_EFUSE_DATA = 0xFC6C  # For the purpose of auto-detecting mode

    HCI_VENDOR_READ_RTK_ROM_VERSION = 0xFC6D
    HCI_VENDOR_ENTER_DEBUG_PASSWORD_CMD = 0xFD60
    HCI_VENDOR_GET_APP_EUID_CMD = 0xFD61



class HCI_PKT_TYPE(IntEnum):
    HCI_CMD = 0x01
    HCI_EVT = 0x04


class HCI_EVT_CMD(IntEnum):
    HCI_EVT_CMD_CMPLT = 0x0E


class HCI_EVT_PARAM_OFFSET(IntEnum):
    HCI_EVT_IDX_PKT_TYPE = 0
    HCI_EVT_IDX_EVT_CMD = 1
    HCI_EVT_IDX_PARAM_LEN = 2
    HCI_EVT_IDX_CMD_OPCODE_LEN = 3
    HCI_EVT_IDX_CMD_OPCODE = 4
    HCI_EVT_IDX_STATUS = 6
    HCI_EVT_IDX_PARAM_BUF = 7

class HCICmdProto(HCIInterface):
    def __init__(self, config, serialHdl):
        self._config = config
        self._serialHdl = serialHdl

    def open(self, serialName, baudrate=115200):
        return self._serialHdl.open(serialName, baudrate)

    def close(self):
        self._serialHdl.close()

    def load_fw(self):
        retCode = self.__hci_flash_init()
        if retCode == ERR_OK:
            time.sleep(self._config.CONFIG_HCI_WAIT_FOR_FLASH_INIT_S)
            return self.__hci_flash_unlock()
        else:
            return retCode

    def set_baudrate(self, baudrate):
        param = [0, 0, 0, 0]
        if baudrate == 1000000:
            param[0] = 0x04
            param[1] = 0x50
            param[2] = 0x0
            param[3] = 0x0
        elif baudrate == 2000000:
            param[0] = 0x02
            param[1] = 0x50
            param[2] = 0x0
            param[3] = 0x0
        elif baudrate == 3000000:
            param[0] = 0x01
            param[1] = 0x80
            param[2] = 0x92
            param[3] = 0x04
        elif baudrate == 230400:
            param[0] = 0x0A
            param[1] = 0xC0
            param[2] = 0x52
            param[3] = 0x02
        else:
            LOG_ERR("Error: Baudrate %d is not supported!" % baudrate)
            return ERR_HCI_NOT_SUPPORT_BAUDRATE

        param_fmt = "<4B"
        param_buf_size = struct.calcsize(param_fmt)
        param_buf = list(struct.pack(param_fmt, param[0], param[1], param[2], param[3]))

        hci_cmd_pkt = self._hci_cmd_pkt_fill(
            HCI_CMD_CODE.HCI_VENDOR_SET_BAUDRATE_CMD.value, param_buf, param_buf_size)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        time.sleep(self._config.CONFIG_WAIT_FOR_BAUDRATE_CHANGE_S)
        self._serialHdl.set_baudrate(baudrate)
        time.sleep(self._config.CONFIG_WAIT_FOR_BAUDRATE_CHANGE_S)

        return ERR_OK

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

        param_fmt = "<I"
        param_buf_size = struct.calcsize(param_fmt)
        for page_idx in range(total_page_cnt):
            erase_addr = addr + page_idx * EFLASH_PAGE_SIZE
            param_buf = list(struct.pack(param_fmt, erase_addr))

            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_PAGE_ERASE.value,
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

    def read(self, addr, rd_size, saveObj):
        if saveObj == None:
            return ERR_SAVE_OBJ_NONE
        if type(saveObj) == list:
            return self.__hci_read_into_buf(addr, rd_size, saveObj)
        elif type(saveObj) == str:
            return self.__hci_read_as_file(addr, rd_size, saveObj)
        else:
            raise Exception("Error: Don't support saveobj type {}".format(type(saveObj)))

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

    def reboot(self):
        default_passwd = []
        for i in range(16):
            default_passwd.append(0)

        if self._config.CONFIG_HCI_GET_APP_EUID_ENABLE:
            log.stop_log()
            app_euid = self._hci_get_app_euid()
            if type(app_euid) != bytes:
                LOG_CRITICAL("get app euid in hci mode fail!")
            log.start_log()

        return self.__hci_dbg_passwd(default_passwd, True)

    def autodetect_firmware(self, prog_mode, fw_ldr_ic_info=None):
        IC_MAGIC_NUM_ADDR = 0x19000
        IC_MAGIC_NUM_SIZE = 4

        if fw_ldr_ic_info == None:
            fw_ldr_ic_info = []

        read_buf = []
        self._serialHdl.set_read_timeout(0.3)
        readRet = self.read(IC_MAGIC_NUM_ADDR, IC_MAGIC_NUM_SIZE, read_buf)
        if readRet != 0:
            LOG_ERR("Error: hci read addr 0x%08X size %d bytes fail!" % (
                IC_MAGIC_NUM_ADDR, IC_MAGIC_NUM_SIZE))
            return readRet

        self._serialHdl.reset_read_timeout()

        magic_word = get_little_endian_int(read_buf, 0)
        ic_id_rom_ver = self.__get_hci_and_rom_by_magic(magic_word, g_query_table)
        if len(ic_id_rom_ver) == 0:
            LOG_ERR("Error: fail to get ic id and rom ver by magic 0x%08X!" % magic_word)
            return ERR_GET_ROM_MAGIC_FAIL

        fw_ldr_ic_info_ret = self.__get_fw_ldr_info(ic_id_rom_ver[0], ic_id_rom_ver[1],
                                             prog_mode)

        if len(fw_ldr_ic_info_ret) == 0:
            LOG_ERR("Error: fail to get ldr info for ic 0x%X rom ver 0x%X mode %d!" % (
            ic_id_rom_ver[0], ic_id_rom_ver[1], prog_mode))
            return ERR_GET_FW_LDR_INFO_FAIL
        else:
            fw_ldr_ic_info += fw_ldr_ic_info_ret

        #to get fw loader directory
        exe_path = os.path.abspath(sys.argv[0])
        if os.path.isdir(exe_path):
            exe_dir = exe_path
        else:
            exe_dir = os.getcwd()

        fw_dir = os.path.join(exe_dir, "fw")
        fw_dir = os.path.join(fw_dir,
                              fw_ldr_ic_info[FW_LDR_INFO_IDX.FW_LDR_IDX_NAME.value])
        LOG_CRITICAL("FW Loader: %s" % fw_dir)

        '''
        start to load and triger fw loader
        '''
        load_fw_ret = self.__load_firmware(fw_dir)
        if load_fw_ret != 0:
            LOG_ERR("Error: load firmware fail!")
            return load_fw_ret
        return ERR_OK

    def trigger_fw_loader(self,fw_ldr_info, prog_mode):
        if prog_mode == T_MODE.FLASH_PATCH_MODE.value:  # Flash Patch, wdg reset
            self.reboot()
        elif prog_mode == T_MODE.RAM_PATCH_VENDOR_WRITE_MODE.value:  # RAM Patch, vendor write
            trigger_reg_list = fw_ldr_info[FW_LDR_INFO_IDX.FW_LDR_IDX_TRIGGER_REG.value]
            ret = 0
            for i, reg in enumerate(trigger_reg_list):
                if reg[0] == 0:
                    break
                if reg[2] == 0:
                    ret = self.__hci_vendor_write(reg[0], reg[1])
                else:
                    if fw_ldr_info[FW_LDR_INFO_IDX.FW_LDR_IDX_IC_ID.value] == 0x8763 and \
                            fw_ldr_info[FW_LDR_INFO_IDX.FW_LDR_IDX_ROM_VER.value] == 0x1:
                        ret = self.__hci_vendor_write(reg[0], reg[1])
                        ret = 0  # ignore error
                    else:
                        ret = self.__hci_vendor_write_without_ack_check(reg[0], reg[1])

                time.sleep(self._config.CONFIG_WAIT_FOR_RAM_PATCH_TRIGGER_S)

        time.sleep(self._config.CONFIG_WAIT_FOR_FW_LOADER_S)
        self._serialHdl.clear_trx_buf()
        return ERR_OK

    def read_efuse_data(self):
        param_buf = struct.pack("<5B", 0x0, 0x50, 0x01, 0x04, 0x0)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_VENDOR_READ.value, param_buf,
                                             len(param_buf))
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        if evt_len == 0:
            LOG_ERR("Error: rev hci evt pkt fail in hci flash init procedure!")
            return ERR_HCI_READ_FAIL

        evt_param_len = hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_LEN.value]
        '''
        receive hci event data: 
        0x04 0x0e param_len  0x02  0x61 0xfc status (parameter option)

        '''
        if evt_param_len < 4:
            LOG_ERR(
                "Error: vendor read evt param len %d is less than 4 bytes!" % evt_param_len)
            LOG_ERR("     read efuse receive hci event data is: ")
            LOG_ERR(hci_evt)
            return ERR_HCI_READ_DATA_SHORT

        status = hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_STATUS.value]

        if status == 0x0C:  # secure device
            '''
            check whether image on flash address 0x804000 is factory code 
            '''
            IMG_CTRL_HEADER_SIZE = 12
            IMG_ID_OFFSET = 4
            FACTORY_CODE_IMG_ADDR = 0x804000
            read_buf = []

            if self.__hci_read_into_buf(FACTORY_CODE_IMG_ADDR, IMG_CTRL_HEADER_SIZE, read_buf) != ERR_OK:
                LOG_ERR("Error: hci read addr 0x%08X size %d bytes fail!" % (
                FACTORY_CODE_IMG_ADDR, IMG_CTRL_HEADER_SIZE))
                return ERR_HCI_READ_FAIL

            if len(read_buf) != IMG_CTRL_HEADER_SIZE:
                LOG_ERR("Error: read image ctrl header from 0x%08x return %d bytes!" %\
                    (FACTORY_CODE_IMG_ADDR,len(read_buf)))
                LOG_ERR(read_buf)
                return ERR_HCI_READ_FAIL

            img_id = read_buf[IMG_ID_OFFSET] + (read_buf[IMG_ID_OFFSET + 1] << 8)
            if img_id == IMG_ID.FactoryCode.value:
                mode = T_MODE.FLASH_PATCH_MODE.value
                return mode
            else:
                LOG_WARNING(
                    "warn: read factory image id 0x%04X at 0x%08X mismatch with 0x%04X." \
                    % (img_id, FACTORY_CODE_IMG_ADDR, IMG_ID.FactoryCode.value))
                LOG_WARNING(read_buf)
                mode = T_MODE.HCI_MODE.value
                return mode
        elif status == 0:  # non-secure,vendor write enable
            mode = T_MODE.RAM_PATCH_VENDOR_WRITE_MODE.value
            return mode
        else:
            LOG_ERR("Cannot auto-detect device type, please use -M option manually!")
            LOG_ERR(" read efuse data return hci evt:")
            LOG_ERR(hci_evt)
            return ERR_HCI_EVT_STATUS

        return mode

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

        flash_set_tb_bit_rst = self.__hci_flash_ioctl(FLASH_IOCTL_CODE.flash_ioctl_set_tb_bit.value,0x01,0x0)
        if flash_set_tb_bit_rst != 0:
            LOG_ERR("Error: flash ioctl set tb bit fail!")
            return flash_set_tb_bit_rst

        flash_set_sw_protect_rst = self.__hci_flash_ioctl(FLASH_IOCTL_CODE.flash_ioctl_set_sw_protect.value,bp_all_lv-1,0x0)
        if flash_set_sw_protect_rst != 0:
            LOG_ERR("Error: flash ioctl lock flash fail!")
            return flash_set_sw_protect_rst
        else:
            LOG_CRITICAL("flash lock ok!")

        return ERR_OK
    def __hci_vendor_write(self, reg_addr, new_reg_val):
        param_buf = struct.pack("<BII", 0x20, reg_addr, new_reg_val)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_VENDOR_WRITE.value, param_buf,
                                             len(param_buf))
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        if evt_len == 0:
            LOG_ERR("Error: rev hci evt pkt fail in vendor write procedure!")
            return ERR_HCI_READ_FAIL

        if self._hci_evt_pkt_status(hci_evt) != 0:
            LOG_ERR("Error: Vendor write fail!")
            return ERR_HCI_EVT_STATUS
        else:
            LOG_CRITICAL("Vendor write OK!")
        return ERR_OK

    def __hci_vendor_write_without_ack_check(self, reg_addr, new_reg_val):
        param_buf = struct.pack("<BII", 0x20, reg_addr, new_reg_val)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_VENDOR_WRITE.value, param_buf,
                                             len(param_buf))
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL
        return ERR_OK

    def __load_firmware(self,fw_img_file):
        if not os.path.isfile(fw_img_file):
            LOG_ERR("Error: fw image %s not exists!" % fw_img_file)
            return ERR_FW_IMG_NOT_EXIST

        file_size = os.path.getsize(fw_img_file)
        if file_size == 0:
            LOG_ERR("Error: fw image file size 0x%X is invalid!")
            return ERR_FW_IMG_SIZE_ZERO
        elif file_size % 4 != 0:
            LOG_ERR("Error: fw image file size 0x%X is not 4 bytes aligned!")
            return ERR_FW_IMG_SIZE_NOT_4_ALIGNED
        else:
            LOG_CRITICAL("start to loader fw img...")

        fp = open(fw_img_file, 'rb')

        PATCH_MSG_LEN = 252
        PKT_SEQ_NUM_SIZE = 1
        cur_data_len = 0
        cmd_param_len = 0
        pkt_seq_num = 0

        frag_num = file_size // PATCH_MSG_LEN
        if file_size % PATCH_MSG_LEN:
            frag_num += 1

        for i in range(frag_num):
            if i == frag_num - 1:
                cur_data_len = file_size - PATCH_MSG_LEN * i
                pkt_seq_num = i
            else:
                cur_data_len = PATCH_MSG_LEN
                pkt_seq_num = i

            pkt_data = list(fp.read(cur_data_len))

            pkt_fmt = "<BHBB%dB" % cur_data_len
            pkt_fmt_size = struct.calcsize(pkt_fmt)
            pkt_buf = struct.pack(pkt_fmt, HCI_PKT_TYPE.HCI_CMD.value,
                                  HCI_CMD_CODE.HCI_VENDOR_DOWNLOAD.value,
                                  cur_data_len + PKT_SEQ_NUM_SIZE,
                                  pkt_seq_num,
                                  *pkt_data)

            written_len = self._hci_cmd_pkt_send(pkt_buf, pkt_fmt_size)
            if written_len != pkt_fmt_size:
                LOG_ERR("Error: send %d bytes fail in load firmware!")
                return ERR_HCI_SEND_DATA_FAIL
            # else:
            #   LOG_CRITICAL("send write command!")
            '''
            receive evt and check evt status
            '''
            load_ldr_ret = self.__hdl_load_firmware_evt(pkt_seq_num)
            if load_ldr_ret != ERR_OK:
                LOG_ERR(
                    "Error: hci load firmware event int the %dth packet fail!" % pkt_seq_num)
                return load_ldr_ret
            else:
                LOG_DEBUG("load  %d/%d success!" % (pkt_seq_num + 1, frag_num))
        LOG_CRITICAL("============ load firmware success!==============")
        return ERR_OK

    def __hdl_load_firmware_evt(self,pkt_seq_num):
        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        if evt_len == 0:
            LOG_ERR("Error: rev hci evt pkt fail in load firmware procedure!")
            return ERR_HCI_READ_FAIL

        expect_evt_data = [0x04, 0x0E, 0x05, 0x02, 0x20, 0xFC, 0x00]
        expect_evt_data.append(pkt_seq_num)

        if not operator.eq(expect_evt_data, hci_evt):
            LOG_ERR(
                "Error: load firmware event and expected event data verifying procedure failed.")
            LOG_ERR("expect event data: ")
            LOG_ERR(expect_evt_data)
            LOG_ERR("receive event data: ")
            LOG_ERR(hci_evt)
            return ERR_HCI_EVT_MISMATCH
        else:
            if self._hci_evt_pkt_status(hci_evt) != 0:
                LOG_ERR("Error: hci load firmware fail!")
                return ERR_HCI_EVT_STATUS
        return ERR_OK

    def __get_fw_ldr_info(self, ic_id, rom_ver, prog_mode):
        for fw_info in fw_ldr_info:
            if fw_info[FW_LDR_INFO_IDX.FW_LDR_IDX_IC_ID.value] == ic_id and \
                    fw_info[FW_LDR_INFO_IDX.FW_LDR_IDX_ROM_VER.value] == rom_ver and \
                    fw_info[FW_LDR_INFO_IDX.FW_LDR_IDX_PROG_MODE.value] == prog_mode:
                return list(fw_info)
        return []
    def __get_hci_and_rom_by_magic(self,magic_word,ic_query_table):
        ic_id_rom_ver = tuple()
        if len(ic_query_table) == 0:
            return ic_id_rom_ver

        for ic_info in ic_query_table:
            if ic_info[QUERY_TABLE_IDX.IDX_MAGIC_WORD.value] == magic_word:
                ic_id_rom_ver = (ic_info[QUERY_TABLE_IDX.IDX_IC_ID.value],ic_info[QUERY_TABLE_IDX.IDX_ROM_VER.value])
                return ic_id_rom_ver

        return ic_id_rom_ver

    def __reboot_through_wdg_reset(self):
        param_fmt = "<3I"
        param_size = struct.calcsize(param_fmt)
        param_buf = struct.pack(param_fmt,
                                FLASH_IOCTL_CODE.flash_ioctl_exec_wdg_reset.value,
                                3,
                                0x5a5a1234)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_IOCTL.value, param_buf,
                                             param_size)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        time.sleep(self._config.CONFIG_HCI_WAIT_FOR_REBOOT_S)
        LOG_CRITICAL("WDG Reset OK!")
        return ERR_OK

    def check_mode(self):
        param_buf = struct.pack("<3I", FLASH_IOCTL_CODE.flash_ioctl_exec_flash_init.value,
                                0x0, 0x0)
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_IOCTL.value, param_buf,
                                             len(param_buf))

        self._serialHdl.set_read_timeout(0.3)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        if evt_len == 0:
            LOG_ERR("Error: please check the device mode in HCI mode!")
            return ERR_HCI_READ_FAIL

        self._serialHdl.reset_read_timeout()
        hci_evt_len = len(hci_evt)
        '''
        hci evt format:
        B  hci cmd type(fixed 4)
        B  hci evt complete(fixed 0xE)
        B  payload length 
        B  hci cmd code length(fixed 2)
        H  cmd code(fixed 0xFC2C)
        B  status
        other payload(payload length - 4)  

        '''
        if hci_evt_len < HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_STATUS.value:
            LOG_CRITICAL(list(hci_evt))
            LOG_ERR("Error: device mode is not in HCI mode!")
            return ERR_HCI_READ_DATA_SHORT

        if hci_evt[
            HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PKT_TYPE.value] != HCI_PKT_TYPE.HCI_EVT.value:
            LOG_ERR("Error: hci evt pkt type 0x%02X is wrong!" % hci_evt[0])
            return ERR_HCI_EVT_PKT_TYPE

        if hci_evt[
            HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_EVT_CMD.value] != HCI_EVT_CMD.HCI_EVT_CMD_CMPLT.value:
            LOG_ERR("Error: HCI event command 0x%02X is wrong!" % hci_evt[1])
            return ERR_HCI_EVT_CMD

        oper_code = hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_CMD_OPCODE.value] + \
                    (hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_CMD_OPCODE.value + 1] << 8)

        if oper_code != HCI_CMD_CODE.HCI_FLASH_IOCTL.value:
            LOG_CRITICAL(list(hci_evt))
            LOG_ERR("Error: device mode is not in HCI mode!")
            return ERR_HCI_EVT_OPCODE

        return ERR_OK

    def send_dbg_passwd(self, port, baudrate, passwd):
        retCode = self.open(port,baudrate)
        if retCode != ERR_OK:
            LOG_ERR("Error: connect %s fail!" % port)
            return retCode
        passwd_list = dbg_passwd_cpy(passwd)

        PASSWORD_BYTE_CNT = 16
        if len(passwd_list) != PASSWORD_BYTE_CNT:
            LOG_ERR("Error: passwd must be 16 bytes hex data!")
            return ERR_DBG_PASSWD_FORMAT_INVALID

        retCode = self.__hci_dbg_passwd(passwd_list)
        self.close()
        return retCode

    def _hci_cmd_pkt_fill(self, opcode, param_buf, param_len):
        hci_cmd_pkt = bytearray(
            struct.pack("<BHB", HCI_PKT_TYPE.HCI_CMD.value, opcode, param_len))

        if param_len > 0:
            hci_cmd_pkt.extend(param_buf)

        return bytes(hci_cmd_pkt)

    def  _hci_cmd_pkt_send(self, hci_cmd_pkt_buf, pkt_len):
        retCode = self._serialHdl.clear_trx_buf()
        if retCode != ERR_OK:
            return retCode

        return self._serialHdl.write(hci_cmd_pkt_buf, pkt_len)

    def _hci_evt_pkt_recv(self, read_buf=None):
        if read_buf == None:
            read_buf = []

        evt_buf = self._serialHdl.read(3)
        if len(evt_buf) == 0:
            LOG_ERR("Error: hci_evt_pkt_rev 3 bytes,but read none!")
            LOG_ERR("      please reboot the board and make sure the board is in hci mode!")
            return 0
        elif len(evt_buf) != 3:
            LOG_ERR("Error: hci_evt_pkt_rev 3 bytes,but read %d bytes!" % len(evt_buf))
            return 0

        param_len = evt_buf[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_LEN.value]

        param_buf = self._serialHdl.read(param_len)
        if len(param_buf) != param_len:
            LOG_ERR("Error: hci_evt_pkt_rev %d bytes paramter,but read %d bytes!" % (
                param_len, len(param_buf)))
            return 0

        read_buf += list(evt_buf)
        read_buf += list(param_buf)

        return len(read_buf)

    def _hci_evt_pkt_status(self, hci_evt):
        '''
        hci event struct:
        B pkt_type
        B evt_opcode
        B evt_param_len
        evt_param_len*B evt_param

        param:
        B cmd_opcode_len = 2
        B cmd_opcode_low byte
        B cmd_opcode_hign byte  cmd_opcode = (cmd_opcode_hign<<8) + cmd_opcode_low
        B status   (index in evt data is 6)
        ...  others
        '''

        hci_evt_len = len(hci_evt)
        if len(hci_evt) < 3:
            LOG_ERR(
                "Error: hci evt content length %d is less than 3 bytes!" % len(hci_evt))
            return ERR_HCI_EVT_LEN

        if hci_evt[
            HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PKT_TYPE.value] != HCI_PKT_TYPE.HCI_EVT.value:
            LOG_ERR("Error: hci evt pkt type 0x%02X is wrong!" % hci_evt[0])
            return ERR_HCI_EVT_PKT_TYPE

        if hci_evt[
            HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_EVT_CMD.value] != HCI_EVT_CMD.HCI_EVT_CMD_CMPLT.value:
            LOG_ERR("Error: HCI opcode 0x%02X is wrong!" % hci_evt[1])
            return ERR_HCI_EVT_OPCODE

        if hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_STATUS.value] != 0:
            LOG_ERR("Error: HCI event status 0x%02X is not 0!" % hci_evt[
                HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_STATUS.value])
            return ERR_HCI_EVT_STATUS

        return ERR_OK

    def __hci_dbg_passwd(self, passwd, reboot=False):
        hci_cmd_pkt = self._hci_cmd_pkt_fill(
            HCI_CMD_CODE.HCI_VENDOR_ENTER_DEBUG_PASSWORD_CMD.value, passwd, len(passwd))
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            LOG_ERR("Error: send hci dbg passwd fail!")
            return ERR_ENTER_DBG_PASSWORD_FAIL
        else:
            if reboot:
                LOG_CRITICAL("send reboot command successfully!")
            else:
                LOG_CRITICAL("Send debug password successfully!")
            return ERR_OK

    def __hci_flash_ioctl(self, flash_ioctl_opcode,param1 = 0x0,param2 = 0x0):
        param_buf = struct.pack("<3I", flash_ioctl_opcode, param1, param2)
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

    def __hci_flash_unlock(self):
        flash_set_sw_protect_rst = self.__hci_flash_ioctl(
            FLASH_IOCTL_CODE.flash_ioctl_set_sw_protect.value)
        if flash_set_sw_protect_rst != 0:
            LOG_ERR("Error: flash ioctl set sw protect fail!")
            return ERR_HCI_FLASH_UNLOCK_FAIL
        return ERR_OK

    def __hci_flash_init(self):
        flash_init_rst = self.__hci_flash_ioctl(
            FLASH_IOCTL_CODE.flash_ioctl_exec_flash_init.value)
        if flash_init_rst != 0:
            LOG_ERR("Error:flash ioctl exec flash init fail!")
            return ERR_HCI_FLASH_INIT_FAIL

        flash_load_cfg_rst = self.__hci_flash_ioctl(
            FLASH_IOCTL_CODE.flash_ioctl_exec_load_cfg.value)
        if flash_load_cfg_rst != 0:
            LOG_ERR("Error:flash ioctl exec load cfg fail!")
            return ERR_HCI_FLASH_LOAD_CFG_FAIL

        return ERR_OK

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
        EVT_PKT_DATA_LEN_SIZE = 4
        EVT_PARAM_FIXED_SIZE = EVT_OPCODE_LEN_SIZE + \
                               EVT_OPCODE_SIZE + \
                               EVT_STATUS_SIZE + \
                               EVT_PKT_DATA_LEN_SIZE
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
            param_buf = struct.pack("<2I", rd_addr, pkt_len)

            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_READ_BUFFER.value,
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

            param_fmt = "<II%dB" % pkt_len
            param_size = struct.calcsize(param_fmt)

            param_buf = list(struct.pack(param_fmt,
                                         (addr + pkt_idx * READ_WRITE_MAX_BYTE_NUM),
                                         pkt_len,
                                         *program_buf[
                                          (pkt_idx * READ_WRITE_MAX_BYTE_NUM):(
                                                  pkt_idx * READ_WRITE_MAX_BYTE_NUM + pkt_len)]))

            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_WRITE_BUFFER.value,
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
            hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_FLASH_WRITE_BUFFER.value,
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

    def _hci_get_app_euid(self):
        hci_cmd_pkt = self._hci_cmd_pkt_fill(HCI_CMD_CODE.HCI_VENDOR_GET_APP_EUID_CMD.value,
                                             None, 0)

        self._serialHdl.set_read_timeout(0.3)
        written_len = self._hci_cmd_pkt_send(hci_cmd_pkt, len(hci_cmd_pkt))
        if written_len != len(hci_cmd_pkt):
            return ERR_HCI_SEND_DATA_FAIL

        hci_evt = []
        evt_len = self._hci_evt_pkt_recv(hci_evt)
        if evt_len == 0:
            LOG_ERR("Error: get app euid please check the device mode in HCI mode!")
            return ERR_HCI_READ_FAIL

        self._serialHdl.reset_read_timeout()
        if self._hci_evt_pkt_status(hci_evt) != 0:
            LOG_ERR("Error: hci get app euid fail!")
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
            I app euid
            }
            '''
            evt_param_len = hci_evt[HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_LEN.value]
            if evt_param_len != 8:
                LOG_ERR(
                    "Error: hci get app euid response payload length is {}, expected 8".format(
                        evt_param_len))
                return ERR_HCI_EVT_LEN
            app_euid_off = HCI_EVT_PARAM_OFFSET.HCI_EVT_IDX_PARAM_BUF
            app_euid = struct.unpack_from("<I",bytes(hci_evt),app_euid_off)

            LOG_DEBUG("get app euid 0x%x" % app_euid)
            return bytes(hci_evt[app_euid_off:app_euid_off+4])


    def _hci_get_rdid(self):
        param_fmt = "<3I"
        param_size = struct.calcsize(param_fmt)
        param_buf = struct.pack(param_fmt,
                                FLASH_IOCTL_CODE.flash_ioctl_get_rdid.value,
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









