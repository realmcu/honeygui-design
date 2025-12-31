import os
import struct
from image_parser import *
from mp_utility import *
from datetime import datetime


from mp_base_def import *
class Handle_occd_img_agent(object):
    def __init__(self, config, cmdParser, cmdHdl):

        self._config = config
        self._cmdParser = cmdParser
        self._cmd_hdl = cmdHdl
        self._occd_hdl = None

        self._occd_hdl_dict = {
            IC_87X3D: Handle_occd_module_config,
            IC_87X3E: Handle_occd_module_config,
            IC_87X3EP: Handle_occd_module_config,
            IC_87X3G: Handle_occd_module_config
        }

    def getOccdHdl(self):
        ic_type = self._config.get_ic_type()

        if self._occd_hdl_dict.__contains__(ic_type):
            self._occd_hdl = self._occd_hdl_dict[ic_type](self._config, self._cmdParser,self._cmd_hdl)
        else:
            LOG_ERR("Error: don't support ic type {} in hci mode".format(ic_type))

        return self._occd_hdl

class Handle_occd_module_config(object):
    def __init__(self, config, cmdParser, cmdHdl):
        self._config = config
        self._cmdParser = cmdParser
        self._cmd_hdl = cmdHdl
        self.ts = datetime.now().strftime("%H%M%S%f")

        self._IMG_HDR_SIZE = self._config.IMG_HDR_SIZE
        self._OEM_CONFIG_FLASH_ADDR = self._config.get_occd_img_addr()  # oem config flash size 0x2000
        self._OEM_CNF_SIZE = self._config.get_occd_img_layout_size()
        self._AUTH_HDR_SIZE = struct.calcsize("<16B256B32B")  # 16B+256+32
        self._IMAGE_ID_OFFSET = struct.calcsize("<HBBH")
        self._PAYLOAD_LEN_OFFSET = struct.calcsize("<HBBHH")

        self._CONFIG_SIGNATURE_SIZE = self.get_occd_cfg_signature_size()
        self._CONFIG_DATA_LENGTH_SIZE = self.get_occd_cfg_data_len_size()
        self._CONFIG_MODULE_ID_SIZE = self.get_occd_cfg_module_id_size()
        self._CONFIG_MODULE_HDR_SIZE = self.get_occd_cfg_module_hdr_size()
        self._is_bt_mac_module_exist = False
        self._bt_addr_module_id = 0
        self._oem_payload_rest_size = 0
        self._bt_mac_addr_entry = []
        self.oem_cfg_buf = []

        self._SIGNATURE_FIELD = 0x12345bb3
        self._MAX_PAD_SIZE = 3
        self._payload_len = 0
        self._lowerstack_module_id_dict = {
            IC_87X3D: 0x0C,
            IC_87X3E: 0x0B,
            IC_87X3EP: 0x0B,
            IC_87X3G:0x0B,
        }
    def get_occd_cfg_signature_size(self):
        cfg_hdr_signature_fmt = "<I"
        hdr_signature_size = struct.calcsize(cfg_hdr_signature_fmt)
        return hdr_signature_size

    def get_occd_cfg_data_len_size(self):
        cfg_hdr_data_len_fmt = "<H"
        hdr_data_len_size = struct.calcsize(cfg_hdr_data_len_fmt)
        return hdr_data_len_size
    def get_occd_cfg_module_id_size(self):
        cfg_hdr_module_id_fmt = "<H"
        hdr_module_id_size = struct.calcsize(cfg_hdr_module_id_fmt)
        return hdr_module_id_size
    def get_occd_cfg_module_hdr_size(self):
        cfg_module_hdr_fmt = "<IHH"
        return struct.calcsize(cfg_module_hdr_fmt)
    def get_occd_cfg_entry_offset_size(self):
        return struct.calcsize("<H")

    def set_payload_len(self, payload_len):
        self._payload_len = payload_len
    def get_payload_len(self):
        return self._payload_len


    def get_occd_cfg_entry_hdr_size(self):
        '''
        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        occd_cfg_entry_hdr_fmt = "<HB"  # offset, Length
        occd_entry_hdr_size = struct.calcsize(occd_cfg_entry_hdr_fmt)
        return occd_entry_hdr_size
    def get_occd_cfg_entry_size(self, data_len):
        '''
        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        occd_cfg_entry_fmt = "<HB{}B{}B".format(data_len, data_len)
        occd_entry_size = struct.calcsize(occd_cfg_entry_fmt)
        return occd_entry_size

    def get_min_occd_cfg_entry_size(self):
        '''
        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        MIN_DATA_LEN = 1
        return self.get_occd_cfg_entry_size(MIN_DATA_LEN)
    def bt_addr_cpy(self, dst_buf, mac_addr, n):
        '''
         mac_addr : %02x:%02x:%02x:%02x:%02x:%02x
        '''
        try:
            BT1, BT2, BT3, BT4, BT5, BT6 = mac_addr.split(":")
        except ValueError as err:
            LOG_ERR("Error:bt mac address split fail -> {}".format(err))
            return ERR_BT_MAC_INVALID

        mac_addr_list = []
        mac_addr_list.append(int(BT6, 16))
        mac_addr_list.append(int(BT5, 16))
        mac_addr_list.append(int(BT4, 16))
        mac_addr_list.append(int(BT3, 16))
        mac_addr_list.append(int(BT2, 16))
        mac_addr_list.append(int(BT1, 16))

        if n != len(mac_addr_list):
            LOG_ERR("Error: copy %d bytes address,but input %s" % (n, mac_addr))
            return ERR_BT_MAC_INVALID

        dst_buf += mac_addr_list
        return ERR_OK
    def get_tmp_name(self):
        tmp_file = "tmp."
        slot = self._cmdParser.get_slot()
        if slot != '':
            tmp_file += slot + ".bin"
        else:
            tmp_file += self.ts+".bin"
        return tmp_file

    def cmac_update(self, cfg_buf):
        CMAC_OFFSET = 0x0
        for i in range(16):
            cfg_buf[CMAC_OFFSET + i] = 0xFF

    def epv_all_in_one(self, img_path, addr, region_size):
        retCode = image_parser_singleton.parse(img_path)
        img_dl_content_size = image_parser_singleton.image_dl_content_size
        if retCode != ERR_OK:
            LOG_ERR("Error: %s image format is inconformity!" % img_path)
            return retCode

        LOG_DEBUG("start CMD:erase page 0x%08x 0x%x" % (addr, region_size))
        erase_ret = self._cmd_hdl.page_erase(addr, region_size)
        if erase_ret != ERR_OK:
            LOG_ERR("Error: page erase fail.address 0x%08X, size 0x%08X" % (
                addr, region_size))
            return erase_ret
        else:
            LOG_CRITICAL("CMD:erase page 0x%08x 0x%x  ok" % (addr, region_size))

        LOG_DEBUG("start CMD:program 0x%08x 0x%x %s" % (addr, img_dl_content_size, img_path))
        program_ret = self._cmd_hdl.program(img_path, addr, img_dl_content_size)
        if program_ret != ERR_OK:
            LOG_ERR("Error program fail.address 0x%08X, size 0x%08X" % (addr, img_dl_content_size))
            return program_ret
        else:
            LOG_CRITICAL("CMD:program 0x%08x 0x%x %s  ok" % (addr, img_dl_content_size, img_path))

        LOG_DEBUG("start CMD:flash verify 0x%08x 0x%x %s" % (addr, img_dl_content_size, img_path))
        verify_ret = self._cmd_hdl.verify(img_path, addr)
        if verify_ret != ERR_OK:
            LOG_ERR("Error: flash verify fail.img %s,address 0x%08X." % (img_path, addr))
            return verify_ret
        else:
            LOG_CRITICAL(
                "CMD:flash verify 0x%08x 0x%x %s ok" % (addr, img_dl_content_size, img_path))
        return ERR_OK
    def GetConfigEntry(self, config_payload_buf, config_data_length, remain_size):
        data_offset = self._CONFIG_MODULE_HDR_SIZE + config_data_length - remain_size

        if remain_size == 0:
            # very well
            return 0

        if remain_size < self.get_min_occd_cfg_entry_size():
            # at least 5
            LOG_WARNING("Warning: Oem config module remain size 0x{:x} < 5, it should be 0!".format(remain_size))
            return -1

        config_entry_length = config_payload_buf[data_offset + self.get_occd_cfg_entry_offset_size()]

        config_entry_size = self.get_occd_cfg_entry_size(config_entry_length)
        if remain_size < config_entry_size:
            LOG_WARNING("Warning: Oem config module remain size 0x{:x} < {}, it should be 0!".format(remain_size,config_entry_size))

            return -1

        return config_entry_size
    def config_pad_length_check(self, config_buf, payload_len):
        '''
        image header

        config payload:

        ConfigMoudleHdr_T ={
        I    Signature_field
        H    Data_Length
        H    Module_Id
        }

        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        img_hdr_size = self._IMG_HDR_SIZE
        data_Len_offset = self._CONFIG_SIGNATURE_SIZE
        module_id_offset = self._CONFIG_SIGNATURE_SIZE + self._CONFIG_DATA_LENGTH_SIZE
        module_hdr_len = self._CONFIG_MODULE_HDR_SIZE

        total_payload_size = payload_len
        parse_cfg_size = 0

        while parse_cfg_size < total_payload_size:
            if total_payload_size - parse_cfg_size < module_hdr_len:
                break
            module_signature, module_length, module_id = self.get_module_hdr_data(config_buf[img_hdr_size + parse_cfg_size:
                                                                                img_hdr_size + parse_cfg_size + module_hdr_len])

            if module_signature != self._SIGNATURE_FIELD:
                LOG_ERR("Error: module 0x{:x} signature mismatch 0x{:x} - 0x{:x}".format(
                    module_id, module_signature, self._SIGNATURE_FIELD))
                return ERR_OEM_MODULE_SIGNATURE_INVALID

            remain_size = module_length

            length_entry = 0
            bcheck = True
            while bcheck:
                cfg_entry_size = self.GetConfigEntry(config_buf[(img_hdr_size + parse_cfg_size):
                                                                (img_hdr_size + parse_cfg_size + module_hdr_len + module_length)],
                                                     module_length,
                                                     remain_size)
                if cfg_entry_size == 0:
                    bcheck = False
                    break
                elif cfg_entry_size == -1:
                    LOG_ERR("Error: oem cfg module length check fail!")
                    return ERR_OEM_CFG_LEN_MISMATCH
                else:
                    length_entry += cfg_entry_size
                    remain_size -= cfg_entry_size
                    continue

            if module_length != length_entry:
                LOG_ERR("Error: oem cfg module 0x{:x} length cheching fail 0x{:x} - 0x{:x}".format(module_id,module_length,length_entry))
                return ERR_OEM_CFG_LEN_MISMATCH
            else:
                parse_cfg_size += module_hdr_len + module_length
                continue

        if parse_cfg_size > total_payload_size:
            LOG_ERR("Error: oem cfg total module payload length 0x{:x} mismatchs with"
                    " image payload size 0x{:x}".format(parse_cfg_size, total_payload_size))
            return ERR_OEM_CFG_LEN_MISMATCH
        else:
            reserve_size = total_payload_size - parse_cfg_size

            if reserve_size == 0:
                LOG_DEBUG("oem cfg length checking pass without pad data.")
                return ERR_OK
            elif reserve_size < module_hdr_len and reserve_size > self._MAX_PAD_SIZE:
                LOG_WARNING("Warn: the oem cfg payload length is with {} bytes external data.".format(reserve_size))

                self.set_payload_len(total_payload_size - reserve_size)
                return ERR_OK
            elif reserve_size <= self._MAX_PAD_SIZE:
                LOG_DEBUG("Note: {} bytes pad data in oem cfg will be removed!".format(reserve_size))
                self.set_payload_len(total_payload_size - reserve_size)
                return ERR_OK
        return ERR_OK

    def config_payload_length_check(self, config_payload_buf):
        '''
        config payload:

        ConfigMoudleHdr_T ={
        I    Signature_field
        H    Data_Length
        H    Module_Id
        }

        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''

        Data_Length_offset = self.get_occd_cfg_signature_size()
        config_data_length = get_little_endian_short(config_payload_buf,
                                                     Data_Length_offset)
        remain_size = config_data_length
        length_field = remain_size

        length_entry = 0
        bcheck = True
        while bcheck:
            cfg_entry_size = self.GetConfigEntry(config_payload_buf, config_data_length,
                                                 remain_size)
            if cfg_entry_size == 0:
                bcheck = False
                break
            else:
                length_entry += cfg_entry_size
                remain_size -= cfg_entry_size
                continue

        if length_field != length_entry:
            return ERR_OEM_CFG_LEN_MISMATCH
        else:
            return ERR_OK

    def McuConfigMerge(self, pDest, destLen, pSrc, srcLen, destCapacity):
        '''
        :param pDest: point to flash config data with 6 bytes config header section
        :param destLen:the data length for config data on the flash
        :param pSrc: point to file config data with 6 bytes config header section
        :param srcLen:the data length for config data from config file
        :param destCapacity:
        :return: merged config data list
        '''
        lastDataLen = destLen
        srcDataLen = srcLen
        matchFlag = 0
        i = 0

        CFG_ENTRY_HDR_SIZE = self.get_occd_cfg_entry_hdr_size()
        if (destLen < CFG_ENTRY_HDR_SIZE) or srcLen < CFG_ENTRY_HDR_SIZE:
            return -1

        while i < srcDataLen:
            offset = pSrc[i] + (pSrc[i + 1] << 8)
            sLen = pSrc[i + 2]
            if sLen == 0:
                LOG_ERR("Error: config entry length is 0!")
                return -1
            sMask = pSrc[(i + CFG_ENTRY_HDR_SIZE + sLen):(
                    i + self.get_occd_cfg_entry_size(sLen))]

            matchFlag = 0

            j = 0
            while j < lastDataLen:
                destOffset = pDest[j] + (pDest[j + 1] << 8)
                dLen = pDest[j + 2]
                dMask = pDest[(j + CFG_ENTRY_HDR_SIZE + dLen):(
                        j + self.get_occd_cfg_entry_size(dLen))]
                if (offset == destOffset) and (sLen == dLen) and (sMask == dMask):
                    for index in range(2 * dLen):
                        pDest[j + CFG_ENTRY_HDR_SIZE + index] = pSrc[
                            i + CFG_ENTRY_HDR_SIZE + index]
                    matchFlag = 1
                    break
                else:
                    j += self.get_occd_cfg_entry_size(dLen)

            if matchFlag != 1:
                j = lastDataLen
                lastDataLen += self.get_occd_cfg_entry_size(sLen)
                if lastDataLen > destCapacity:
                    LOG_ERR("Error: config data merging length overflow.")
                    return -1
                else:
                    pDest[j : j] = pSrc[i:(i + self.get_occd_cfg_entry_size(sLen))]

            i += self.get_occd_cfg_entry_size(sLen)

        return pDest

    def get_bt_mac_entry_by_x(self, mac_addr):
        BTMAC_ADDR_BTYE_SIZE = 6
        btmac_config_entry = [0x44, 0x00, 0x06]

        #get bt address list and prepare bt address entry
        mac_addr_list = []
        if self.bt_addr_cpy(mac_addr_list, mac_addr, BTMAC_ADDR_BTYE_SIZE) != ERR_OK:
            LOG_ERR("Error: bt_addr_cpy convert BT address fail!")
            return (ERR_BT_MAC_INVALID, btmac_config_entry)
        else:
            btmac_config_entry += mac_addr_list

        for i in range(BTMAC_ADDR_BTYE_SIZE):
            btmac_config_entry.append(0xFF)

        return (ERR_OK, btmac_config_entry)

    def read_oem_cfg_payload_len(self):
        '''
        image header(4KB):
           cmac : 16 B
           signature : 256B
           hash :  32B

           crc16 :2B
           ic type : 1B
           secure version : 1B
           ctrl_flag:2B
           image id: 2B
           payload length: 4B
           ......
        '''
        # check oem cfg flash address image id, and get payload length

        img_ctrl_hdr_buf = []
        read_ret = self._cmd_hdl.read(
            self._OEM_CONFIG_FLASH_ADDR + self._AUTH_HDR_SIZE,
            IMG_CTRL_HDR_SIZE, img_ctrl_hdr_buf)
        if read_ret != ERR_OK:
            LOG_ERR("Error: read oem config image control header fail!")
            return read_ret

        image_id = get_little_endian_short(img_ctrl_hdr_buf, self._IMAGE_ID_OFFSET)
        payload_len = get_little_endian_int(img_ctrl_hdr_buf, self._PAYLOAD_LEN_OFFSET)
        if image_id != IMG_ID.OCCD.value:
            LOG_ERR("Error:set_bt_addr is only meaningful for oem-config file.")
            LOG_ERR("       oem config image id is 0x%04X, the image id on oem cfg address is 0x%04X." % (
                IMG_ID.OCCD.value, image_id))
            return ERR_IMG_ID_MISMATCH

        if payload_len + self._IMG_HDR_SIZE > self._OEM_CNF_SIZE:
            LOG_ERR("Error oem cfg payload length check fail with payload length {0x:x}".format(payload_len))
            return ERR_OEM_CFG_LEN_MISMATCH
        else:
            self.set_payload_len(payload_len)
        return ERR_OK

    def get_module_hdr_data(self,module_hdr_buf):
        module_signature = get_little_endian_int(module_hdr_buf, 0)
        module_len = get_little_endian_short(module_hdr_buf, self._CONFIG_SIGNATURE_SIZE)
        module_id = get_little_endian_short(module_hdr_buf, self._CONFIG_SIGNATURE_SIZE + self._CONFIG_DATA_LENGTH_SIZE)
        return (module_signature, module_len, module_id)

    def set_exist_bt_mac_module(self,is_exist):
        self._is_bt_mac_module_exist = is_exist
    def get_exist_bt_mac_module(self):
        return self._is_bt_mac_module_exist
    def set_bt_mac_module_id(self,module_id):
        self._bt_addr_module_id = module_id
    def get_bt_mac_module_id(self):
        return self._bt_addr_module_id
    def set_bt_mac_entry(self,bt_mac_addr_entry):
        self._bt_mac_addr_entry = bt_mac_addr_entry
    def get_bt_mac_entry(self):
        return self._bt_mac_addr_entry
    def set_payload_rest_len(self, rest_len):
        self._oem_payload_rest_size = rest_len
    def get_payload_rest_len(self):
        return self._oem_payload_rest_size

    def find_bt_mac_module(self, oem_cfg_buf, payload_len, bt_addr_module_id):
        module_cfg_len = payload_len
        module_skip_size = 0
        module_len = 0
        module_id = 0
        '''
        config header:
               signature: 4B  0x12345bb3
               data len:  2B
               module id: 2B

        config entry item:
             ConfigEntry_T = {
                H    Offset
                B    Length
                B    pData(unsigned char with the count of Length)
                B    pMask(unsigned char with the count of Length)
                } 

        '''
        # read oem cfg first module cfg signature field
        while module_cfg_len > self._CONFIG_MODULE_HDR_SIZE:
            module_signature, module_len, module_id = self.get_module_hdr_data(
                oem_cfg_buf[self._IMG_HDR_SIZE + module_skip_size:
                            self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_MODULE_HDR_SIZE])

            if module_signature != self._SIGNATURE_FIELD:
                LOG_ERR("Error: oem config module signature 0x{:x} mismatches with 0x{:x}!".format( \
                    module_signature, self._SIGNATURE_FIELD))
                return ERR_OEM_CFG_EMPTY

            if module_cfg_len < self._CONFIG_MODULE_HDR_SIZE + module_len:
                LOG_ERR("Error: oem cfg module remain length 0x{:x} is less than image payload length (0x{:x} + 0x{:x})!".format( \
                    module_cfg_len, self._CONFIG_MODULE_HDR_SIZE, module_len))
                return ERR_OEM_CFG_MODULE_LEN_INVALID

            if module_id != bt_addr_module_id:
                module_skip_size += self._CONFIG_MODULE_HDR_SIZE + module_len
                module_cfg_len -= self._CONFIG_MODULE_HDR_SIZE + module_len
                continue
            else:
                self.set_exist_bt_mac_module(True)
                break

        if self.get_exist_bt_mac_module() == False:
            module_len = 0

        return (module_skip_size, module_len)

    def merge_bt_mac_oem_buf(self,module_skip_size,module_len):
        payload_len = self.get_payload_len()
        is_bt_mac_module_exist = self.get_exist_bt_mac_module()
        btmac_config_entry = self.get_bt_mac_entry()
        bt_addr_module_id = self.get_bt_mac_module_id()
        oem_payload_rest_size = self.get_payload_rest_len()
        tmp_oem_cfg_file = self.get_tmp_name()
        CONFIG_OFFSET = self._IMG_HDR_SIZE + module_skip_size
        pad_size = 0

        if is_bt_mac_module_exist and module_len > 0:
            # check payload length
            check_fmt_ret = self.config_payload_length_check(self.oem_cfg_buf[self._IMG_HDR_SIZE + module_skip_size:
                                                                         self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_MODULE_HDR_SIZE + module_len])
            if check_fmt_ret != ERR_OK:
                LOG_ERR("Error: flash oem config payload length checking fail.")
                return (check_fmt_ret,tmp_oem_cfg_file,pad_size)

            # merge,then update data length in signaute and payload length in header
            '''
            ConfigMoudleHdr_T ={
            I    Signature_field
            H    Data_Length
            H    Module_Id
            }

            '''
            # CONFIG_HEADER_SECTION_SIZE = CONFIG_SIGNATURE_SIZE + CONFIG_DATA_LENGTH_SIZE
            CONFIG_OFFSET = self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_MODULE_HDR_SIZE

            mergedCfgList = self.McuConfigMerge(self.oem_cfg_buf[CONFIG_OFFSET:CONFIG_OFFSET + module_len],
                                                module_len,
                                                btmac_config_entry,
                                                len(btmac_config_entry),
                                                oem_payload_rest_size)
            data_length = len(mergedCfgList)
            add_module_len = 0
            if data_length < module_len:
                LOG_ERR("oem cfg merge fail, please check the McuConfigMerge code!")
                return (ERR_OEM_CFG_MODULE_LEN_INVALID,tmp_oem_cfg_file,pad_size)
            else:
                add_module_len = data_length - module_len

            self.oem_cfg_buf[self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_SIGNATURE_SIZE] = (add_module_len + module_len) & 0xff
            self.oem_cfg_buf[self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_SIGNATURE_SIZE + 1] = ((add_module_len + module_len) >> 8) & 0xff

        elif is_bt_mac_module_exist and module_len == 0:
            CONFIG_OFFSET = self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_MODULE_HDR_SIZE
            mergedCfgList = btmac_config_entry

            add_module_len = len(btmac_config_entry)
            self.oem_cfg_buf[self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_SIGNATURE_SIZE] = (add_module_len + module_len) & 0xff
            self.oem_cfg_buf[self._IMG_HDR_SIZE + module_skip_size + self._CONFIG_SIGNATURE_SIZE + 1] = ((add_module_len + module_len) >> 8) & 0xff

        elif is_bt_mac_module_exist == False:
            CONFIG_OFFSET = self._IMG_HDR_SIZE + module_skip_size
            bt_mac_module_len = len(btmac_config_entry)
            module_hdr_data = struct.pack("<IHH", self._SIGNATURE_FIELD, bt_mac_module_len,bt_addr_module_id)

            bt_mac_module = list(module_hdr_data) + btmac_config_entry
            mergedCfgList = bt_mac_module

            add_module_len = len(bt_mac_module)
        else:
            LOG_ERR("Error: enter into unexpected region for merge_bt_mac_oem_buf {} {}!".format(is_bt_mac_module_exist,module_len))
            return (ERR_OEM_CFG_MODULE_LEN_INVALID,tmp_oem_cfg_file,pad_size)


        if (payload_len + add_module_len) % 4 != 0:
            pad_size = 4 - ((payload_len + add_module_len) % 4)
        new_payload_len = (payload_len + add_module_len + 3) // 4 * 4

        self.oem_cfg_buf[self._AUTH_HDR_SIZE + self._PAYLOAD_LEN_OFFSET] = new_payload_len & 0xff
        self.oem_cfg_buf[self._AUTH_HDR_SIZE + self._PAYLOAD_LEN_OFFSET + 1] = (new_payload_len & 0xff00) >> 8
        self.oem_cfg_buf[self._AUTH_HDR_SIZE + self._PAYLOAD_LEN_OFFSET + 2] = (new_payload_len & 0xff0000) >> 16
        self.oem_cfg_buf[self._AUTH_HDR_SIZE + self._PAYLOAD_LEN_OFFSET + 3] = (new_payload_len & 0xff000000) >> 24

        try:
            LOG_DEBUG("tmp file is %s", tmp_oem_cfg_file)
            with open(tmp_oem_cfg_file, "wb") as fp:
                fp.write(bytes(self.oem_cfg_buf[:CONFIG_OFFSET]))
                fp.write(bytes(mergedCfgList))
                if (CONFIG_OFFSET + module_len) < (self._IMG_HDR_SIZE + payload_len):
                    fp.write(bytes(self.oem_cfg_buf[(CONFIG_OFFSET + module_len) : (self._IMG_HDR_SIZE + payload_len)]))
                if pad_size > 0:
                    fp.write(bytes([0xFF]*pad_size))
                fp.close()
        except:
            LOG_ERR("Error: fail to write back oem cfg data.")
            raise
        return (ERR_OK,tmp_oem_cfg_file,pad_size)

    def read_oem_cfg_flash_data(self,to_read_back_len):

        self.oem_cfg_buf = []
        read_ret = self._cmd_hdl.read(self._OEM_CONFIG_FLASH_ADDR,
                                      to_read_back_len,
                                      self.oem_cfg_buf)
        if read_ret != ERR_OK:
            LOG_ERR("Error: read oem config 0x%x bytes fail!" % to_read_back_len)
            return read_ret
        return ERR_OK

    def set_bt_mac(self, mac_addr):
        # get module id
        bt_addr_module_id = self._get_bt_bd_addr_module_id()
        if bt_addr_module_id == -1:
            return ERR_OEM_MODULE_ID_INVALID
        else:
            self.set_bt_mac_module_id(bt_addr_module_id)

        # get bt mac entry data from arg -x
        err_ret, btmac_config_entry = self.get_bt_mac_entry_by_x(mac_addr)
        if err_ret != ERR_OK:
            return err_ret
        else:
            self.set_bt_mac_entry(btmac_config_entry)

        # read oem cfg payload length in image ctrl header
        err_ret = self.read_oem_cfg_payload_len()
        if err_ret != ERR_OK:
            return err_ret
        else:
            payload_len = self.get_payload_len()

        # read back oem cfg
        read_ret = self.read_oem_cfg_flash_data(self._IMG_HDR_SIZE + payload_len)
        if read_ret != ERR_OK:
            return read_ret

        # check oem cfg length, adjust payload length if with pad data( 1~3 bytes 0xff at the end)
        cfg_len_check_ret = self.config_pad_length_check(self.oem_cfg_buf, payload_len)
        if cfg_len_check_ret != ERR_OK:
            return cfg_len_check_ret
        else:
            payload_len = self.get_payload_len()

        # calculate oem config payload rest size
        self.set_payload_rest_len(self._OEM_CNF_SIZE - self._IMG_HDR_SIZE - payload_len)

        # update cmac region in IC
        self.cmac_update(self.oem_cfg_buf)

        module_skip_size, module_len = self.find_bt_mac_module(self.oem_cfg_buf, payload_len, bt_addr_module_id)
        err_ret, tmp_oem_cfg_file,pad_size = self.merge_bt_mac_oem_buf(module_skip_size,module_len)

        if err_ret != ERR_OK:
            LOG_ERR("Error: merge_bt_mac_oem_buf fail, err_ret 0x{:x}".format(err_ret))
            return err_ret

        dl_ret = self.epv_all_in_one(tmp_oem_cfg_file, self._OEM_CONFIG_FLASH_ADDR, self._OEM_CNF_SIZE)
        if dl_ret != ERR_OK:
            LOG_ERR("Error: do_addmac- erase,program or verify error!")
            os.remove(tmp_oem_cfg_file)
            return dl_ret
        else:
            os.remove(tmp_oem_cfg_file)
            return ERR_OK

    def fread_without_mp_header(self, img_path, dst_buf=None):
        if dst_buf == None:
            dst_buf = []

        skip_offset = 0
        try:
            mp_hdr_exist = image_parser_singleton.is_with_mp_hdr(img_path)
        except Exception as err:
            LOG_FATAL(err)
            return (ERR_IMG_NOT_PARSED,0)

        if mp_hdr_exist == True:
            skip_offset = MP_HEADER_SIZE
        elif mp_hdr_exist == False:
            skip_offset = 0

        img_content_size = image_parser_singleton.image_dl_content_size

        try:
            with open(img_path, 'rb') as fp:
                fp.seek(skip_offset)
                dst_buf += list(fp.read(img_content_size))
                fp.close()
        except:
            LOG_ERR("Error: fail to open %s." % img_path)
            return (ERR_FILE_OPEN_FAIL,0)

        return (ERR_OK,len(dst_buf))


    def download_occd_image(self, img_file_path, img_addr, mac_addr="",
                            disable_merge=False):
        if disable_merge == False:
            ret = self.do_config_merge(img_file_path, img_addr, mac_addr)
            if ret != 0:
                if ret == ERR_IMG_ID_MISMATCH:
                    LOG_CRITICAL(" -> Next to try to download occd image without merging")
                    if self.do_config_disable_merge(img_file_path, img_addr, mac_addr) != 0:
                        LOG_ERR("Error: OCCD config without merging fail!")
                        return ERR_FLASH_DOWNLOAD_FAIL
                    else:
                        LOG_DEBUG("download OCCD config successfully!")
                        return ERR_OK
                else:
                    LOG_ERR("Error: OCCD config merge fail!")
                    return ERR_FLASH_DOWNLOAD_FAIL
            else:
                LOG_DEBUG("OCCD config merge ok!")
                return ERR_OK
        else:
            if self.do_config_disable_merge(img_file_path, img_addr, mac_addr) != 0:
                LOG_ERR("Error: OCCD config without merging fail!")
                return ERR_FLASH_DOWNLOAD_FAIL
            else:
                LOG_DEBUG("download OCCD config successfully!")
                return ERR_OK
    def get_img_id_offset(self,ic_type):
        if ic_type == IC_87X3G:
            return 0xca
        else:
            return (self._AUTH_HDR_SIZE + self._IMAGE_ID_OFFSET)
    def get_img_id(self, file_content_buf):
        ic_type = self._config.get_ic_type()
        img_id_offset = self.get_img_id_offset(ic_type)

        img_id = get_little_endian_short(file_content_buf, img_id_offset)
        return img_id
    def McuConfigMoudleMerge(self, pDest, destLen, pSrc, srcLen, destCapacity):
        '''
        :param pDest: point to flash config data
        :param destLen:the data length for config data on the flash
        :param pSrc: point to file config data 
        :param srcLen:the data length for config data from config file
        :param destCapacity:
        :return: merged config data list
        '''
        lastDataLen = destLen
        srcDataLen = srcLen
        matchFlag = 0
        i = 0

        cfg_entry_hdr_size = struct.calcsize("<HB")
        cfg_module_hdr_size = self._CONFIG_MODULE_HDR_SIZE
        if (destLen < cfg_module_hdr_size) or srcLen < cfg_module_hdr_size:
            return (ERR_OEM_CFG_MODULE_LEN_INVALID, pDest, destLen)

        src_skip_size = 0
        src_cfg_len = srcLen

        new_dst_cfg_len = destLen
        if destLen == srcLen and pDest == pSrc:
            return (ERR_OK,pDest,destLen)

        while src_skip_size < srcDataLen:
            src_msig, src_mlen, src_mid = self.get_module_hdr_data(
                pSrc[src_skip_size: src_skip_size + self._CONFIG_MODULE_HDR_SIZE])

            if src_msig != self._SIGNATURE_FIELD:
                LOG_ERR("Error: oem config module signature 0x{:x} mismatches with 0x{:x}!".format( \
                    src_msig, self._SIGNATURE_FIELD))
                return (ERR_OEM_CFG_EMPTY, pDest, new_dst_cfg_len)

            if src_cfg_len < self._CONFIG_MODULE_HDR_SIZE + src_mlen:
                LOG_ERR(
                    "Error: oem cfg module remain length 0x{:x} is less than image payload length (0x{:x} + 0x{:x})!".format( \
                        src_cfg_len, self._CONFIG_MODULE_HDR_SIZE, src_mlen))
                return (ERR_OEM_CFG_MODULE_LEN_INVALID, pDest, new_dst_cfg_len)

            dst_cfg_len = destLen
            dst_skip_size = 0
            is_find_module = False
            while (dst_skip_size < destLen) and (dst_cfg_len >= self._CONFIG_MODULE_HDR_SIZE):

                dst_msig, dst_mlen, dst_mid = self.get_module_hdr_data(
                    pDest[dst_skip_size: dst_skip_size + self._CONFIG_MODULE_HDR_SIZE])

                if dst_msig != self._SIGNATURE_FIELD:
                    LOG_ERR("Error: oem config module signature 0x{:x} mismatches with 0x{:x}!".format( \
                        dst_msig, self._SIGNATURE_FIELD))
                    return (ERR_OEM_CFG_EMPTY, pDest, new_dst_cfg_len)

                if dst_cfg_len < self._CONFIG_MODULE_HDR_SIZE + dst_mlen:
                    LOG_ERR(
                        "Error: oem cfg module remain length 0x{:x} is less than image payload length (0x{:x} + 0x{:x})!".format( \
                            dst_cfg_len, self._CONFIG_MODULE_HDR_SIZE, dst_mlen))
                    return (ERR_OEM_CFG_MODULE_LEN_INVALID, pDest, new_dst_cfg_len)

                if dst_mid == src_mid:
                    is_find_module = True
                    break
                else:
                    dst_skip_size += self._CONFIG_MODULE_HDR_SIZE + dst_mlen
                    dst_cfg_len -=  self._CONFIG_MODULE_HDR_SIZE + dst_mlen

                if dst_cfg_len < self._CONFIG_MODULE_HDR_SIZE:
                    LOG_WARNING("Warning : remain {} bytes in the oem cfg flash data module parsing.")
                    break

            if is_find_module == False:
                add_entry_size = self._CONFIG_MODULE_HDR_SIZE + src_mlen
                if new_dst_cfg_len + add_entry_size > destCapacity:
                    LOG_ERR("Error: add module data fail for length overflow {} > {}.".format(
                        new_dst_cfg_len + add_entry_size, destCapacity))
                    return (ERR_OEM_CFG_MODULE_LEN_INVALID, pDest, new_dst_cfg_len)

                pDest[new_dst_cfg_len : new_dst_cfg_len] = pSrc[src_skip_size: src_skip_size + self._CONFIG_MODULE_HDR_SIZE + src_mlen]
                new_dst_cfg_len += self._CONFIG_MODULE_HDR_SIZE + src_mlen

                src_skip_size += self._CONFIG_MODULE_HDR_SIZE + src_mlen
                src_cfg_len -= self._CONFIG_MODULE_HDR_SIZE + src_mlen
                continue

            else:
                i = src_skip_size + self._CONFIG_MODULE_HDR_SIZE
                need_entry_match = True
                if src_mlen == dst_mlen:
                    if pSrc[src_skip_size:src_skip_size+src_mlen] == pDest[dst_skip_size:dst_skip_size+dst_mlen]:
                        need_entry_match = False
                        dst_skip_size += self._CONFIG_MODULE_HDR_SIZE + dst_mlen
                        dst_cfg_len -= self._CONFIG_MODULE_HDR_SIZE + dst_mlen

                        if dst_cfg_len < self._CONFIG_MODULE_HDR_SIZE:
                            LOG_WARNING("Warning : remain {} bytes in the oem cfg flash data module parsing.")
                            break
                if need_entry_match:
                    while i < src_skip_size + self._CONFIG_MODULE_HDR_SIZE + src_mlen:
                        sOffset = pSrc[i] + (pSrc[i + 1] << 8)
                        sLen = pSrc[i + 2]
                        if sLen == 0:
                            LOG_ERR("Error: config length is 0!")
                            return (ERR_OEM_CFG_MODULE_LEN_INVALID, pDest, new_dst_cfg_len)
                        sMask = pSrc[(i + cfg_entry_hdr_size + sLen):(
                                i + self.get_occd_cfg_entry_size(sLen))]

                        matchFlag = 0

                        j = dst_skip_size + self._CONFIG_MODULE_HDR_SIZE
                        while j < dst_skip_size + self._CONFIG_MODULE_HDR_SIZE + dst_mlen:
                            destOffset = pDest[j] + (pDest[j + 1] << 8)
                            dLen = pDest[j + 2]
                            dMask = pDest[(j + cfg_entry_hdr_size + dLen):(
                                    j + self.get_occd_cfg_entry_size(dLen))]


                            if (sOffset == destOffset) and (sLen == dLen) and (sMask == dMask):
                                for index in range(2 * dLen):
                                    pDest[j + cfg_entry_hdr_size + index] = pSrc[
                                        i + cfg_entry_hdr_size + index]
                                matchFlag = 1
                                break
                            else:
                                j += self.get_occd_cfg_entry_size(dLen)

                        if matchFlag != 1:
                            j = dst_skip_size + self._CONFIG_MODULE_HDR_SIZE + dst_mlen
                            add_entry_size = self.get_occd_cfg_entry_size(sLen)


                            if new_dst_cfg_len + add_entry_size > destCapacity:
                                LOG_ERR("Error: config data merging length overflow {} > {}.".format(
                                    new_dst_cfg_len + add_entry_size, destCapacity))
                                return (ERR_OEM_CFG_MODULE_LEN_INVALID, pDest, new_dst_cfg_len)
                            else:
                                pDest[j:j] += pSrc[i:(i + self.get_occd_cfg_entry_size(sLen))]
                                dst_mlen += add_entry_size
                                pDest[dst_skip_size + self._CONFIG_MODULE_HDR_SIZE + self._CONFIG_SIGNATURE_SIZE] = dst_mlen&0xFF
                                pDest[dst_skip_size + self._CONFIG_MODULE_HDR_SIZE + self._CONFIG_SIGNATURE_SIZE] = (dst_mlen&0xFF00)>>8
                                new_dst_cfg_len += add_entry_size


                        i += self.get_occd_cfg_entry_size(sLen)

                src_skip_size += self._CONFIG_MODULE_HDR_SIZE + src_mlen
                src_cfg_len -= self._CONFIG_MODULE_HDR_SIZE + src_mlen
                continue

        return (ERR_OK, pDest, new_dst_cfg_len)
    def do_config_merge(self, img_file_path, img_addr, mac_addr=""):
        file_pad_size = 0
        self.oem_cfg_buf = []
        err_ret,file_content_len = self.fread_without_mp_header(img_file_path, self.oem_cfg_buf)
        if  err_ret != ERR_OK:
            LOG_ERR("Error: fail to read config file %s." % img_file_path)
            return err_ret

        img_id = self.get_img_id(self.oem_cfg_buf)
        if img_id != IMG_ID.OCCD.value:
            LOG_ERR("Error: config merge is only meaningful for oem-config file.")
            LOG_ERR("       oem config image id is 0x%04X, the image id is 0x%04X." % (
                IMG_ID.OCCD.value, img_id))
            return ERR_IMG_ID_MISMATCH

        #merge bt mac in the oem cfg image file
        payload_len = get_little_endian_int(self.oem_cfg_buf[self._AUTH_HDR_SIZE:self._AUTH_HDR_SIZE + IMG_CTRL_HDR_SIZE], self._PAYLOAD_LEN_OFFSET)
        self.set_payload_len(payload_len)

        # check oem cfg length, adjust payload length if with pad data( 1~3 bytes 0xff at the end)
        cfg_len_check_ret = self.config_pad_length_check(self.oem_cfg_buf, payload_len)
        if cfg_len_check_ret != ERR_OK:
            return cfg_len_check_ret
        else:
            payload_len = self.get_payload_len()
        # calculate oem config payload rest size
        self.set_payload_rest_len(self._OEM_CNF_SIZE - self._IMG_HDR_SIZE - payload_len)


        is_tmp_file = False
        tmp_oem_cfg_file = img_file_path

        if mac_addr != "":
            # get module id
            bt_addr_module_id = self._get_bt_bd_addr_module_id()
            if bt_addr_module_id == -1:
                return ERR_OEM_MODULE_ID_INVALID
            else:
                self.set_bt_mac_module_id(bt_addr_module_id)

            # get bt mac entry data from arg -x
            err_ret, btmac_config_entry = self.get_bt_mac_entry_by_x(mac_addr)
            if err_ret != ERR_OK:
                return err_ret
            else:
                self.set_bt_mac_entry(btmac_config_entry)


            # update cmac region in IC
            self.cmac_update(self.oem_cfg_buf)

            module_skip_size, module_len = self.find_bt_mac_module(self.oem_cfg_buf, payload_len, bt_addr_module_id)
            err_ret, tmp_oem_cfg_file,file_pad_size = self.merge_bt_mac_oem_buf(module_skip_size,module_len)

            if err_ret != ERR_OK:
                LOG_ERR("Error: merge_bt_mac_oem_buf fail, err_ret {}".format(err_ret))
                return err_ret
            else:
                img_file_path = tmp_oem_cfg_file
                is_tmp_file = True


        file_content_buf = []
        mp_hdr_exist = False
        try:
            LOG_DEBUG("oem cfg file is %s", img_file_path)
            file_len = os.path.getsize(img_file_path)
            if file_len < self._IMG_HDR_SIZE:
                LOG_ERR("Error: saved oem config image file {} length is less than 0x{:x}".format(img_file_path, self._IMG_HDR_SIZE))
                return ERR_OEM_CFG_LEN_MISMATCH
            else:
                if is_tmp_file:
                    file_payload_len = file_len - self._IMG_HDR_SIZE - file_pad_size
                else:
                    file_payload_len = payload_len

                    mp_hdr_exist = image_parser_singleton.is_with_mp_hdr(img_file_path)
            with open(img_file_path, "rb") as fp:
                if mp_hdr_exist == False:
                    fp.seek(self._IMG_HDR_SIZE)
                else:
                    fp.seek(self._IMG_HDR_SIZE + MP_HEADER_SIZE)
                file_content_buf = list(fp.read(file_payload_len))
                fp.close()
            if is_tmp_file:
                os.remove(img_file_path)
        except:
            LOG_ERR("Error: fail to write back oem cfg data.")
            raise


        err_ret, payload_len = self.read_back_oem_cfg_on_flash()
        if err_ret != ERR_OK:
            LOG_ERR("Error: read_back_oem_cfg_on_flash fail with {}".format(err_ret))
            return err_ret

        destCapacity = self._OEM_CNF_SIZE
        err_ret, pDest,pDestLen = self.McuConfigMoudleMerge(self.oem_cfg_buf[self._IMG_HDR_SIZE : self._IMG_HDR_SIZE + payload_len],
                                                            payload_len, file_content_buf,
                                                            file_payload_len, destCapacity)
        payload_len = pDestLen

        pad_size = 0
        if payload_len % 4 != 0:
            pad_size = 4 - (payload_len % 4)
        new_payload_len = (payload_len+ 3) // 4 * 4

        self.oem_cfg_buf[self._IMG_HDR_SIZE + self._PAYLOAD_LEN_OFFSET] = new_payload_len & 0xff
        self.oem_cfg_buf[self._IMG_HDR_SIZE + self._PAYLOAD_LEN_OFFSET + 1] = (new_payload_len & 0xff00) >> 8
        self.oem_cfg_buf[self._IMG_HDR_SIZE + self._PAYLOAD_LEN_OFFSET + 2] = (new_payload_len & 0xff0000) >> 16
        self.oem_cfg_buf[self._IMG_HDR_SIZE + self._PAYLOAD_LEN_OFFSET + 3] = (new_payload_len & 0xff000000) >> 24

        try:
            tmp_file = self.get_tmp_name()
            LOG_DEBUG("module merge tmp file is %s", tmp_file)
            with open(tmp_file, "wb") as fp:
                fp.write(bytes(self.oem_cfg_buf[:self._IMG_HDR_SIZE ]))
                fp.write(bytes(pDest))
                if pad_size > 0:
                    fp.write(bytes([0xFF]*pad_size))
                fp.close()
        except:
            LOG_ERR("Error: fail to write back oem cfg data.")
            raise

        err_ret = self.epv_all_in_one(tmp_file, img_addr, self._config.get_occd_img_layout_size())
        if err_ret != ERR_OK:
            LOG_ERR("Error: do_config_merge- erase,program or verify error!")
            os.remove(tmp_file)
            return err_ret
        else:
            os.remove(tmp_file)
            return ERR_OK

        return ERR_OK


    def read_back_oem_cfg_on_flash(self):
        payload_len = 0
        # read oem cfg payload length in image ctrl header
        err_ret = self.read_oem_cfg_payload_len()
        if err_ret != ERR_OK:
            return (err_ret, payload_len)
        else:
            payload_len = self.get_payload_len()

        # read back oem cfg
        read_ret = self.read_oem_cfg_flash_data(self._IMG_HDR_SIZE + payload_len)
        if read_ret != ERR_OK:
            return (read_ret, payload_len)

        # check oem cfg length, adjust payload length if with pad data( 1~3 bytes 0xff at the end)
        cfg_len_check_ret = self.config_pad_length_check(self.oem_cfg_buf, payload_len)
        if cfg_len_check_ret != ERR_OK:
            return (cfg_len_check_ret,payload_len)
        else:
            payload_len = self.get_payload_len()
        return (ERR_OK, payload_len)

    def do_config_disable_merge(self, img_file_path, img_addr, mac_addr=""):
        self.oem_cfg_buf = []
        err_ret,file_content_len = self.fread_without_mp_header(img_file_path, self.oem_cfg_buf)
        if  err_ret != ERR_OK:
            LOG_ERR("Error: fail to read config file %s." % img_file_path)
            return err_ret

        img_id = self.get_img_id(self.oem_cfg_buf)

        if img_id != IMG_ID.OCCD.value:
            LOG_ERR("Error: config merge is only meaningful for oem-config file.")
            LOG_ERR("       oem config image id is 0x%04X, the image id is 0x%04X." % (
                IMG_ID.OCCD.value, img_id))
            return ERR_IMG_ID_MISMATCH

        payload_len = get_little_endian_int(self.oem_cfg_buf[self._AUTH_HDR_SIZE:self._AUTH_HDR_SIZE + IMG_CTRL_HDR_SIZE], self._PAYLOAD_LEN_OFFSET)
        self.set_payload_len(payload_len)

        is_tmp_file = False
        if mac_addr != "":
            # get module id
            bt_addr_module_id = self._get_bt_bd_addr_module_id()
            if bt_addr_module_id == -1:
                return ERR_OEM_MODULE_ID_INVALID
            else:
                self.set_bt_mac_module_id(bt_addr_module_id)

            # get bt mac entry data from arg -x
            err_ret, btmac_config_entry = self.get_bt_mac_entry_by_x(mac_addr)
            if err_ret != ERR_OK:
                return err_ret
            else:
                self.set_bt_mac_entry(btmac_config_entry)


            # check oem cfg length, adjust payload length if with pad data( 1~3 bytes 0xff at the end)
            cfg_len_check_ret = self.config_pad_length_check(self.oem_cfg_buf, payload_len)
            if cfg_len_check_ret != ERR_OK:
                return cfg_len_check_ret
            else:
                payload_len = self.get_payload_len()
            # calculate oem config payload rest size
            self.set_payload_rest_len(self._OEM_CNF_SIZE - self._IMG_HDR_SIZE - payload_len)

            # update cmac region in IC
            self.cmac_update(self.oem_cfg_buf)

            module_skip_size, module_len = self.find_bt_mac_module(self.oem_cfg_buf, payload_len, bt_addr_module_id)
            err_ret, tmp_oem_cfg_file, pad_size = self.merge_bt_mac_oem_buf(module_skip_size,module_len)

            if err_ret != ERR_OK:
                LOG_ERR("Error: merge_bt_mac_oem_buf fail, err_ret 0x{:x}".format(err_ret))
                return err_ret
            else:
                img_file_path = tmp_oem_cfg_file
                is_tmp_file = True

        if img_addr != self._OEM_CONFIG_FLASH_ADDR:
            LOG_INFO("INFO: download oem cfg image on specified address 0x{:08x}".format(img_addr))

        dl_ret = self.epv_all_in_one(img_file_path, img_addr, self._OEM_CNF_SIZE)
        if dl_ret != ERR_OK:
            LOG_ERR("Error: do_addmac- erase,program or verify error!")
            if is_tmp_file:
                os.remove(img_file_path)
            return dl_ret
        else:
            if is_tmp_file:
                os.remove(img_file_path)
            return ERR_OK

    def _get_bt_bd_addr_module_id(self):
        ic_type = self._config.get_ic_type()

        if self._lowerstack_module_id_dict.__contains__(ic_type):
            return self._lowerstack_module_id_dict[ic_type]
        else:
            LOG_ERR("Error: Don't support to update bt_bd_addr in system config for ic {}".format(ic_type))
            return -1


class Handle_occd_img(object):
    def __init__(self, config, cmdParser, cmdHdl):
        self._config = config
        self._cmdParser = cmdParser
        self._cmd_hdl = cmdHdl
        self.ts=datetime.now().strftime("%H%M%S%f")

    def download_occd_image(self, img_file_path, img_addr, mac_addr="",
                            disable_merge=False):
        if disable_merge == False:
            if self.do_config_merge(img_file_path, img_addr, mac_addr) != 0:
                LOG_ERR("Error: OCCD config merge fail!")
                return ERR_FLASH_DOWNLOAD_FAIL
            else:
                LOG_DEBUG("OCCD config merge ok!")
                return ERR_OK
        else:
            if self.do_config_disable_merge(img_file_path, img_addr, mac_addr) != 0:
                LOG_ERR("Error: OCCD config without merging fail!")
                return ERR_FLASH_DOWNLOAD_FAIL
            else:
                LOG_DEBUG("download OCCD config successfully!")
                return ERR_OK

    def do_config_merge(self, img_file_path, img_addr, mac_addr=""):
        CONFIG_SIGNATURE_SIZE = self.get_occd_cfg_signature_size()
        CONFIG_DATA_LENGTH_SIZE = self.get_occd_cfg_data_len_size()
        PAYLOAD_LEN_OFFSET = 8

        IMG_HDR_SIZE = self._config.IMG_HDR_SIZE

        file_content_buf = []
        if self.fread_without_mp_header(img_file_path, file_content_buf) <= 0:
            LOG_ERR("Error: fail to read config file %s." % img_file_path)
            return -1

        IMG_ID_OFFSET = 4
        img_id, = struct.unpack_from("<H", bytes(file_content_buf[:IMG_CTRL_HDR_SIZE]),
                                     IMG_ID_OFFSET)

        if img_id != IMG_ID.OCCD.value:
            LOG_ERR("Error: config merge is only meaningful for oem-config file.")
            LOG_ERR("       oem config image id is 0x%04X, the image id is 0x%04X." % (
                IMG_ID.OCCD.value, img_id))
            return ERR_IMG_ID_MISMATCH

        if mac_addr != "":
            LOG_DEBUG("Adding BT address for oem config!")
            file_content_buf = self.append_btmac_config_entry(file_content_buf, mac_addr)
            if len(file_content_buf) == 0:
                LOG_ERR("Error: fail to append BT address %s in config file." % mac_addr)
                return -1

        # check payload length
        if self.config_payload_length_check(file_content_buf[IMG_HDR_SIZE:]) != 0:
            LOG_ERR("Error: OCCD config image payload length checking fail.")
            return -1
        cfg_data_length_from_file = get_little_endian_short(file_content_buf,
                                                            IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE)

        try:
            tmp_file = self.get_tmp_name()
            LOG_DEBUG("tmp file is %s", tmp_file)
            with open(tmp_file, "wb") as fp:
                fp.write(bytes(file_content_buf))
                fp.close()
        except:
            LOG_ERR("Error: fail to write back oem cfg data.")
            raise

        # check if the config region in flash is empty
        data_length_list = []

        if self._cmd_hdl.read(img_addr + IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE,
                              CONFIG_DATA_LENGTH_SIZE,
                              data_length_list) != 0:
            LOG_ERR("Error: fail to read config data length,address 0x%08X." % (
                    img_addr + IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE))
            os.remove(tmp_file)
            return ERR_FLASH_READ_FAIL

        if (data_length_list[0] == 0xff) and \
                (data_length_list[1] == 0xff):
            # do erase,program,and verify sequence
            if self.epv_all_in_one(tmp_file, img_addr,
                                   self._config.get_occd_img_layout_size()) != 0:
                LOG_ERR("Error: do_config_merge- erase, program or verify failed!")
                os.remove(tmp_file)
                return -1
            else:
                os.remove(tmp_file)
                return 0
        else:  # not empty
            # read back original config image
            buf_orig = []
            cfg_data_length = get_little_endian_short(data_length_list, 0)
            if self._cmd_hdl.read(img_addr,
                                  cfg_data_length + CONFIG_SIGNATURE_SIZE + CONFIG_DATA_LENGTH_SIZE + IMG_HDR_SIZE,
                                  buf_orig) != 0:
                LOG_ERR("Error: fail to read config data ,address 0x%08X, size 0x%08X" % (
                    img_addr, cfg_data_length))
                os.remove(tmp_file)
                return -1
            else:
                # check payload length
                if self.config_payload_length_check(buf_orig[IMG_HDR_SIZE:]) != 0:
                    LOG_ERR(
                        "Error: payload length checking for OCCD config read from flash fail.")
                    return -1

            # update cmac region in IC
            self.cmac_update(buf_orig)

            # merge,then update data length in signaute and payload length in header
            '''
            ConfigHeaderSection_T = 
            {
               I  Signature_Field
               H  Data_Length
            }

            '''
            CONFIG_HEADER_SECTION_SIZE = CONFIG_SIGNATURE_SIZE + CONFIG_DATA_LENGTH_SIZE

            CONFIG_OFFSET = IMG_HDR_SIZE + CONFIG_HEADER_SECTION_SIZE
            mergedCfgList = self.McuConfigMerge(buf_orig[CONFIG_OFFSET:],
                                                cfg_data_length,
                                                file_content_buf[CONFIG_OFFSET:],
                                                cfg_data_length_from_file,
                                                IMG_HDR_SIZE - CONFIG_HEADER_SECTION_SIZE)

            data_length = len(mergedCfgList)
            buf_orig[IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE] = data_length & 0xff
            buf_orig[IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE + 1] = (data_length >> 8) & 0xff

            payload_len = data_length + self.get_occd_cfg_hdr_size()
            buf_orig[PAYLOAD_LEN_OFFSET] = payload_len & 0xff
            buf_orig[PAYLOAD_LEN_OFFSET + 1] = (payload_len & 0xff00) >> 8
            buf_orig[PAYLOAD_LEN_OFFSET + 2] = (payload_len & 0xff0000) >> 16
            buf_orig[PAYLOAD_LEN_OFFSET + 3] = (payload_len & 0xff000000) >> 24

            try:
                tmp_file = self.get_tmp_name()
                LOG_DEBUG("tmp file is %s", tmp_file)
                with open(tmp_file, "wb") as fp:
                    fp.write(bytes(buf_orig[:CONFIG_OFFSET]))
                    fp.write(bytes(mergedCfgList))
                    fp.close()
            except:
                LOG_ERR("Error: fail to write back oem cfg data.")
                raise
                return -1

            if self.epv_all_in_one(tmp_file, img_addr,
                                   self._config.get_occd_img_layout_size()) != 0:
                LOG_ERR("Error: do_config_merge- erase,program or verify error!")
                os.remove(tmp_file)
                return -1
            else:
                os.remove(tmp_file)
                return 0

        os.remove(tmp_file)
        return 0

    def do_config_disable_merge(self, img_file_path, img_addr, mac_addr=""):
        file_content_buf = []
        if self.fread_without_mp_header(img_file_path, file_content_buf) <= 0:
            LOG_ERR("Error: fail to read config file %s." % img_file_path)
            return -1

        IMG_HDR_SIZE = self._config.IMG_HDR_SIZE

        IMG_ID_OFFSET = 4
        img_id, = struct.unpack_from("<H", bytes(file_content_buf[:IMG_CTRL_HDR_SIZE]),
                                     IMG_ID_OFFSET)

        if img_id != IMG_ID.OCCD.value:
            LOG_ERR("Error: config merge is only meaningful for oem-config file.")
            LOG_ERR("       oem config image id is 0x%04X, the image id is 0x%04X." % (
                IMG_ID.OCCD.value, img_id))
            return -1

        if mac_addr != "":
            LOG_DEBUG("Adding BT address for oem config!")
            file_content_buf = self.append_btmac_config_entry(file_content_buf, mac_addr)
            if len(file_content_buf) == 0:
                LOG_ERR("Error: fail to append BT address %s in config file." % mac_addr)
                return -1

        # check payload length
        if self.config_payload_length_check(file_content_buf[IMG_HDR_SIZE:]) != 0:
            LOG_ERR("Error: OCCD image config payload length checking fail.")
            return -1

        try:
            tmp_file = self.get_tmp_name()
            LOG_DEBUG("tmp file is %s", tmp_file)
            with open(tmp_file, "wb") as fp:
                fp.write(bytes(file_content_buf))
                fp.close()
        except:
            LOG_ERR("Error: fail to write back oem cfg data.")
            raise
            return -1

        # do erase,program,and verify sequence
        if self.epv_all_in_one(tmp_file, img_addr,
                               self._config.get_occd_img_layout_size()) != 0:
            LOG_ERR("Error: do_config_merge- erase, program or verify failed!")
            os.remove(tmp_file)
            return -1
        else:
            os.remove(tmp_file)
            return 0

    def get_occd_cfg_signature_size(self):
        cfg_hdr_signature_fmt = "<I"
        hdr_signature_size = struct.calcsize(cfg_hdr_signature_fmt)
        return hdr_signature_size

    def get_occd_cfg_data_len_size(self):
        cfg_hdr_data_len_fmt = "<H"
        hdr_data_len_size = struct.calcsize(cfg_hdr_data_len_fmt)
        return hdr_data_len_size

    def get_occd_cfg_hdr_size(self):
        '''
        ConfigHeaderSection_T ={
         I    Signature_field
         H    Data_Length
         }
        '''
        cfg_hdr_section_fmt = "<IH"
        occd_cfg_hdr_size = struct.calcsize(cfg_hdr_section_fmt)
        return occd_cfg_hdr_size

    def get_occd_cfg_entry_hdr_size(self):
        '''
        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        occd_cfg_entry_hdr_fmt = "<HB"  # offset, Length
        occd_entry_hdr_size = struct.calcsize(occd_cfg_entry_hdr_fmt)
        return occd_entry_hdr_size

    def get_occd_cfg_entry_size(self, data_len):
        '''
        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        occd_cfg_entry_fmt = "<HB{}B{}B".format(data_len, data_len)
        occd_entry_size = struct.calcsize(occd_cfg_entry_fmt)
        return occd_entry_size

    def get_min_occd_cfg_entry_size(self):
        '''
        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        MIN_DATA_LEN = 1
        return self.get_occd_cfg_entry_size(MIN_DATA_LEN)

    def bt_addr_cpy(self, dst_buf, mac_addr, n):
        '''
         mac_addr : %02x:%02x:%02x:%02x:%02x:%02x
        '''
        try:
            BT1, BT2, BT3, BT4, BT5, BT6 = mac_addr.split(":")
        except ValueError as err:
            LOG_ERR("Error:bt mac address split fail -> {}".format(err))
            return ERR_BT_MAC_INVALID

        mac_addr_list = []
        mac_addr_list.append(int(BT6, 16))
        mac_addr_list.append(int(BT5, 16))
        mac_addr_list.append(int(BT4, 16))
        mac_addr_list.append(int(BT3, 16))
        mac_addr_list.append(int(BT2, 16))
        mac_addr_list.append(int(BT1, 16))

        if n != len(mac_addr_list):
            LOG_ERR("Error: copy %d bytes address,but input %s" % (n, mac_addr))
            return ERR_BT_MAC_INVALID

        dst_buf += mac_addr_list
        return ERR_OK

    def cmac_update(self, cfg_buf):
        PAYLOAD_CMAC_OFFSET = 0xEE0
        HEAD_CMAC_OFFSET = 0xFF0
        for i in range(16):
            cfg_buf[PAYLOAD_CMAC_OFFSET + i] = 0xFF
            cfg_buf[HEAD_CMAC_OFFSET + i] = 0xFF

    def fread_without_mp_header(self, img_path, dst_buf=None):
        if dst_buf == None:
            dst_buf = []

        skip_offset = 0
        try:
            mp_hdr_exist = image_parser_singleton.is_with_mp_hdr(img_path)
        except Exception as err:
            LOG_FATAL(err)
            return ERR_IMG_NOT_PARSED

        if mp_hdr_exist == True:
            skip_offset = MP_HEADER_SIZE
        elif mp_hdr_exist == False:
            skip_offset = 0

        img_content_size = image_parser_singleton.image_dl_content_size

        try:
            with open(img_path, 'rb') as fp:
                fp.seek(skip_offset)
                dst_buf += list(fp.read(img_content_size))
                fp.close()
                return len(dst_buf)
        except:
            LOG_ERR("Error: fail to open %s." % img_path)
            return ERR_FILE_OPEN_FAIL

        return ERR_OK

    def GetConfigEntry(self, config_payload_buf, config_data_length, remain_size):
        data_offset = self.get_occd_cfg_hdr_size() + config_data_length - remain_size

        if remain_size == 0:
            # very well
            return 0

        if remain_size < self.get_min_occd_cfg_entry_size():
            # at least 5
            return 0

        config_entry_length = config_payload_buf[data_offset + 2]

        config_entry_size = self.get_occd_cfg_entry_size(config_entry_length)
        if remain_size < config_entry_size:
            return 0

        return config_entry_size

    def config_payload_length_check(self, config_payload_buf):
        '''
        config payload:

        ConfigHeaderSection_T ={
        I    Signature_field
        H    Data_Length
        }

        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''

        Data_Length_offset = self.get_occd_cfg_signature_size()
        config_data_length = get_little_endian_short(config_payload_buf,
                                                     Data_Length_offset)
        remain_size = config_data_length
        length_field = remain_size

        length_entry = 0
        bcheck = True
        while bcheck:
            cfg_entry_size = self.GetConfigEntry(config_payload_buf, config_data_length,
                                                 remain_size)
            if cfg_entry_size == 0:
                bcheck = False
                break
            else:
                length_entry += cfg_entry_size
                remain_size -= cfg_entry_size
                continue

        if length_field != length_entry:
            return ERR_OEM_CFG_LEN_MISMATCH
        else:
            return ERR_OK

    def config_mac_check(self, config_img_buf, mac_item, item_len):
        '''
        config payload:

        ConfigHeaderSection_T ={
        I    Signature_field
        H    Data_Length
        }

        ConfigEntry_T = {
        H    Offset
        B    Length
        B    pData(unsigned char with the count of Length)
        B    pMask(unsigned char with the count of Length)
        }
        '''
        btmac_config_offset = 0x0044
        btmac_config_len = 0x06
        Data_Length_offset = self.get_occd_cfg_signature_size()
        config_data_length = get_little_endian_short(config_img_buf,
                                                     self._config.IMG_HDR_SIZE + Data_Length_offset)
        remain_size = config_data_length

        length_entry = 0
        bFind = False
        config_header_section_size = self.get_occd_cfg_hdr_size()
        while not bFind:
            if remain_size < self.get_min_occd_cfg_entry_size():
                LOG_DEBUG("in find bt mac item procedure: remain size < 5")
                break
            data_offset = self._config.IMG_HDR_SIZE + config_header_section_size + config_data_length - remain_size

            config_entry_offset = get_little_endian_short(config_img_buf, data_offset)
            config_entry_length = config_img_buf[data_offset + 2]
            cfg_entry_size = self.get_occd_cfg_entry_size(config_entry_length)

            if remain_size < cfg_entry_size:
                LOG_ERR(
                    "Error:config_mac_check fail in the config entry length checking,item offset: 0x%x, length: 0x%x!" % ( \
                        config_entry_offset, config_entry_length))
                break

            if (config_entry_offset == btmac_config_offset) and \
                    (config_entry_length == btmac_config_len):
                for i in range(item_len):
                    config_img_buf[data_offset + i] = mac_item[i]
                bFind = True
                break
            else:
                length_entry += cfg_entry_size
                remain_size -= cfg_entry_size
                continue

        return bFind

    def append_btmac_config_entry(self, data_buf, mac):
        append_data_list = []
        BTCONFIG_ENTRY_LEN_OFF = self._config.IMG_HDR_SIZE + self.get_occd_cfg_signature_size()

        BTMAC_ENTRY_DATA_LEN = 6  # fixed size
        BTMAC_CONFIG_ENTRY_SIZE = self.get_occd_cfg_entry_size(BTMAC_ENTRY_DATA_LEN)
        btmac_config_entry = [0x44, 0x00, 0x06]

        if self.bt_addr_cpy(btmac_config_entry, mac, BTMAC_ENTRY_DATA_LEN) != ERR_OK:
            LOG_ERR("Error: convert BT address error!")
            return append_data_list

        cur_len = len(btmac_config_entry)

        for i in range(BTMAC_CONFIG_ENTRY_SIZE - cur_len):
            btmac_config_entry.append(0xFF)

        bFind = self.config_mac_check(data_buf, btmac_config_entry,
                                      len(btmac_config_entry))
        if bFind:
            return data_buf

        # to check payload length of the image and config data length
        PAYLOAD_LEN_OFFSET = 8
        payload_len = get_little_endian_int(data_buf, PAYLOAD_LEN_OFFSET)
        config_data_len = get_little_endian_short(data_buf, BTCONFIG_ENTRY_LEN_OFF)

        # 4 byte alignment is complemented
        OCCD_IMG_ALIGNED_SIZE = 4
        aligned_size = (config_data_len + self.get_occd_cfg_hdr_size()) % OCCD_IMG_ALIGNED_SIZE
        if aligned_size != 0:
            aligned_size = OCCD_IMG_ALIGNED_SIZE - aligned_size

        if payload_len != config_data_len + self.get_occd_cfg_hdr_size():
            if aligned_size == payload_len - (config_data_len + self.get_occd_cfg_hdr_size()):
                data_buf = data_buf[:-aligned_size]
                payload_len = payload_len - aligned_size

        data_buf += btmac_config_entry

        payload_len = payload_len + BTMAC_CONFIG_ENTRY_SIZE

        data_buf[PAYLOAD_LEN_OFFSET] = (payload_len & 0xFF)
        data_buf[PAYLOAD_LEN_OFFSET + 1] = (payload_len >> 8) & 0xFF
        data_buf[PAYLOAD_LEN_OFFSET + 2] = (payload_len >> 16) & 0xFF
        data_buf[PAYLOAD_LEN_OFFSET + 3] = (payload_len >> 24) & 0xFF

        config_data_len = config_data_len + BTMAC_CONFIG_ENTRY_SIZE
        data_buf[BTCONFIG_ENTRY_LEN_OFF] = (config_data_len & 0xFF)
        data_buf[BTCONFIG_ENTRY_LEN_OFF + 1] = (config_data_len >> 8) & 0xFF
        append_data_list = data_buf
        return append_data_list

    def epv_all_in_one(self, img_path, addr, region_size):
        file_size = os.path.getsize(img_path)
        retCode = image_parser_singleton.parse(img_path)
        if retCode != ERR_OK:
            LOG_ERR("Error: %s image format is inconformity!" % img_path)
            return retCode

        LOG_DEBUG("start CMD:erase page 0x%08x 0x%x" % (addr, region_size))
        erase_ret = self._cmd_hdl.page_erase(addr, region_size)
        if erase_ret != ERR_OK:
            LOG_ERR("Error: page erase fail.address 0x%08X, size 0x%08X" % (
                addr, region_size))
            return erase_ret
        else:
            LOG_CRITICAL("CMD:erase page 0x%08x 0x%x  ok" % (addr, region_size))

        LOG_DEBUG("start CMD:program 0x%08x 0x%x %s" % (addr, file_size, img_path))
        program_ret = self._cmd_hdl.program(img_path, addr, file_size)
        if program_ret != ERR_OK:
            LOG_ERR("Error program fail.address 0x%08X, size 0x%08X" % (addr, file_size))
            return program_ret
        else:
            LOG_CRITICAL("CMD:program 0x%08x 0x%x %s  ok" % (addr, file_size, img_path))

        LOG_DEBUG("start CMD:flash verify 0x%08x 0x%x %s" % (addr, file_size, img_path))
        verify_ret = self._cmd_hdl.verify(img_path, addr)
        if verify_ret != ERR_OK:
            LOG_ERR("Error: flash verify fail.img %s,address 0x%08X." % (img_path, addr))
            return verify_ret
        else:
            LOG_CRITICAL(
                "CMD:flash verify 0x%08x 0x%x %s ok" % (addr, file_size, img_path))
        return ERR_OK

    def McuConfigMerge(self, pDest, destLen, pSrc, srcLen, destCapacity):
        '''
        :param pDest: point to flash config data with 6 bytes config header section
        :param destLen:the data length for config data on the flash
        :param pSrc: point to file config data with 6 bytes config header section
        :param srcLen:the data length for config data from config file
        :param destCapacity:
        :return: merged config data list
        '''
        lastDataLen = destLen
        srcDataLen = srcLen
        matchFlag = 0
        i = 0

        CFG_ENTRY_HDR_SIZE = self.get_occd_cfg_entry_hdr_size()
        if (destLen < CFG_ENTRY_HDR_SIZE) or srcLen < CFG_ENTRY_HDR_SIZE:
            return -1

        while i < srcDataLen:
            offset = pSrc[i] + (pSrc[i + 1] << 8)
            sLen = pSrc[i + 2]
            if sLen == 0:
                LOG_ERR("Error: config length is 0!")
                return -1
            sMask = pSrc[(i + CFG_ENTRY_HDR_SIZE + sLen):(
                    i + self.get_occd_cfg_entry_size(sLen))]

            matchFlag = 0

            j = 0
            while j < lastDataLen:
                destOffset = pDest[j] + (pDest[j + 1] << 8)
                dLen = pDest[j + 2]
                dMask = pDest[(j + CFG_ENTRY_HDR_SIZE + dLen):(
                        j + self.get_occd_cfg_entry_size(dLen))]
                if (offset == destOffset) and (sLen == dLen) and (sMask == dMask):
                    for index in range(2 * dLen):
                        pDest[j + CFG_ENTRY_HDR_SIZE + index] = pSrc[
                            i + CFG_ENTRY_HDR_SIZE + index]
                    matchFlag = 1
                    break
                else:
                    j += self.get_occd_cfg_entry_size(dLen)

            if matchFlag != 1:
                j = lastDataLen
                lastDataLen += self.get_occd_cfg_entry_size(sLen)
                if lastDataLen > destCapacity:
                    LOG_ERR("Error: config data merging length overflow.")
                    return -1
                else:
                    pDest += pSrc[i:(i + self.get_occd_cfg_entry_size(sLen))]

            i += self.get_occd_cfg_entry_size(sLen)

        return pDest

    def get_tmp_name(self):
        tmp_file = "tmp."
        slot = self._cmdParser.get_slot()
        if slot != '':
            tmp_file += slot + ".bin"
        else:
            tmp_file += self.ts+".bin"
        return tmp_file

    def set_bt_mac(self, mac_addr):
        BTMAC_ADDR_BTYE_SIZE = 6
        btmac_config_entry = [0x44, 0x00, 0x06]
        OEM_CONFIG_FLASH_ADDR = self._config.get_occd_img_addr()  # oem config flash size 0x2000

        OEM_CNF_SIZE = self._config.get_occd_img_layout_size()
        CONFIG_SIGNATURE_SIZE = self.get_occd_cfg_signature_size()
        CONFIG_DATA_LENGTH_SIZE = self.get_occd_cfg_data_len_size()
        PAYLOAD_LEN_OFFSET = 8

        mac_addr_list = []
        if self.bt_addr_cpy(mac_addr_list, mac_addr, BTMAC_ADDR_BTYE_SIZE) != ERR_OK:
            LOG_ERR("Error: bt_addr_cpy convert BT address fail!")
            return ERR_BT_MAC_INVALID
        else:
            btmac_config_entry += mac_addr_list

        for i in range(BTMAC_ADDR_BTYE_SIZE):
            btmac_config_entry.append(0xFF)

        config_len_buf = []
        IMG_HDR_SIZE = self._config.IMG_HDR_SIZE
        read_ret = self._cmd_hdl.read(
            OEM_CONFIG_FLASH_ADDR + IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE,
            CONFIG_DATA_LENGTH_SIZE, config_len_buf)
        if read_ret != ERR_OK:
            LOG_ERR("Error: read oem config length fail!")
            return read_ret

        if config_len_buf[0] == 0xff and config_len_buf[1] == 0xff:
            LOG_ERR("Error: do_addmac fail- oem config region is empty!")
            return ERR_OEM_CFG_EMPTY

        config_len = get_little_endian_short(config_len_buf, 0)
        to_read_back_len = IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE + CONFIG_DATA_LENGTH_SIZE + config_len

        oem_cfg_buf = []
        read_ret = self._cmd_hdl.read(OEM_CONFIG_FLASH_ADDR,
                                      to_read_back_len,
                                      oem_cfg_buf)
        if read_ret != ERR_OK:
            LOG_ERR("Error: read oem config %d bytes fail!" % to_read_back_len)
            return read_ret

        # update cmac region in IC
        self.cmac_update(oem_cfg_buf)

        # check payload length
        check_fmt_ret = self.config_payload_length_check(oem_cfg_buf[IMG_HDR_SIZE:])
        if check_fmt_ret != ERR_OK:
            LOG_ERR("Error: flash oem config payload length checking fail.")
            return check_fmt_ret

        # merge,then update data length in signaute and payload length in header
        '''
        ConfigHeaderSection_T = 
        {
           I  Signature_Field
           H  Data_Length
        }

        '''
        CONFIG_HEADER_SECTION_SIZE = CONFIG_SIGNATURE_SIZE + CONFIG_DATA_LENGTH_SIZE
        CONFIG_OFFSET = IMG_HDR_SIZE + CONFIG_HEADER_SECTION_SIZE

        mergedCfgList = self.McuConfigMerge(oem_cfg_buf[CONFIG_OFFSET:],
                                            config_len,
                                            btmac_config_entry,
                                            len(btmac_config_entry),
                                            IMG_HDR_SIZE - CONFIG_HEADER_SECTION_SIZE)
        data_length = len(mergedCfgList)
        oem_cfg_buf[IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE] = data_length & 0xff
        oem_cfg_buf[IMG_HDR_SIZE + CONFIG_SIGNATURE_SIZE + 1] = (data_length >> 8) & 0xff

        payload_len = data_length + self.get_occd_cfg_hdr_size()
        oem_cfg_buf[PAYLOAD_LEN_OFFSET] = payload_len & 0xff
        oem_cfg_buf[PAYLOAD_LEN_OFFSET + 1] = (payload_len & 0xff00) >> 8
        oem_cfg_buf[PAYLOAD_LEN_OFFSET + 2] = (payload_len & 0xff0000) >> 16
        oem_cfg_buf[PAYLOAD_LEN_OFFSET + 3] = (payload_len & 0xff000000) >> 24

        try:
            tmp_file = self.get_tmp_name()
            LOG_DEBUG("tmp file is %s", tmp_file)
            with open(tmp_file, "wb") as fp:
                fp.write(bytes(oem_cfg_buf[:CONFIG_OFFSET]))
                fp.write(bytes(mergedCfgList))
                fp.close()
        except:
            LOG_ERR("Error: fail to write back oem cfg data.")
            raise

        dl_ret = self.epv_all_in_one(tmp_file, OEM_CONFIG_FLASH_ADDR, OEM_CNF_SIZE)
        if dl_ret != ERR_OK:
            LOG_ERR("Error: do_addmac- erase,program or verify error!")
            os.remove(tmp_file)
            return dl_ret
        else:
            os.remove(tmp_file)
            return ERR_OK
