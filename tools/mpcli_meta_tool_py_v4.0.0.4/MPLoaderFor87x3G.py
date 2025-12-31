import time

from MPLoaderFor8773E import *
from MPLoader_cmd_def import *
from flash_ioctl_code_def import *
from crc import CRC
from mp_utility import *
from mp_setting import *
from image_parser import *

class FLASH_TYPE(IntEnum):
    FLASH_NOR_TYPE = 0
    FLASH_NAND_TYPE = 1
    SD_NAND_TYPE = 2
    SD_EMMC_TYPE = 3

class MPLoaderFor87x3G(MPLoaderFor8773E):
    def __init__(self, config, serialHdl):
        super(MPLoaderFor8773E, self).__init__(config, serialHdl)

        self._config = config
        self._serialHdl = serialHdl

        self._handshake_type = HANDSHAKE_TYPE.RUN_MP_LOADER
        self._cache_handshake_data = []
        self._stop_handshake = False
        self._sync_event = None
        self._wire_mode = TWO_WIRE_MODE

        self.flash_type = FLASH_TYPE.FLASH_NOR_TYPE.value
        self._has_get_flash_type = False
        self.nand_flash_start_addr = 0x80000000
        self.nand_flash_size_max = 0x40000000
        self.nand_flash_sys_cfg_addr = 0x80100000
        self.storage_type = FLASH_TYPE.SD_NAND_TYPE.value
        self.is_parallel_cmd = self._config.CONFIG_USE_PARALLEL_CMD

        self.is_use_erase_v2 = True
        self.nand_flash_block_size = 0
        self._rom_ver = None
    def __reset(self):
        self._handshake_request_buf = []
        self._cache_handshake_data = []
        self._stop_handshake = False
        self._sync_event = None
        self._handshake_rst = False
        self._check_rsp_thread_hdl = None
        self._send_handshake_thread_hdl = None
    def __generate_read_efuse_data(self,cmd_code,addr,size,cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []
        '''
        B  start byte
        H  cmd code
        B  bank   fixed 0
        H  addr
        H  size
        H  crc
        '''
        cmd_buf_part1_fmt = "<BHBHH"
        bank = 0
        cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt,
                                    MP_START_BYTE,
                                    cmd_code,
                                    bank,
                                    addr,
                                    size)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (cmd_buf_part1_size + cmd_buf_part2_size)

    def read_efuse_data_on_ram(self, addr, size):
        return self.read_efuse_data(CmdID.CMD_READ_EFUSE_ON_RAM.value, addr, size)

    def read_efuse_data_on_phy(self, addr, size):
        return self.read_efuse_data(CmdID.CMD_READ_EFUSE_DATA.value, addr, size)

    def read_efuse_data(self, cmdid, addr, size):

        read_efuse_buf = []
        DATA_SIZE_PER_PACKET = 1024  # for gdma method 16K, if polling, set it to 32k
        data_len = size
        pkt_cnt =  (data_len + DATA_SIZE_PER_PACKET - 1) // DATA_SIZE_PER_PACKET

        for pkt_idx in range(pkt_cnt):
            cmd_buf = []

            bytes_remain = data_len - (pkt_idx * DATA_SIZE_PER_PACKET)
            to_read_len = min(DATA_SIZE_PER_PACKET, bytes_remain)

            to_read_address = addr + pkt_idx * DATA_SIZE_PER_PACKET

            cmd_len = self.__generate_read_efuse_data(cmdid, to_read_address, to_read_len, cmd_buf)

            written_len = self._serialHdl.write(cmd_buf, cmd_len)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: read efuse data to send %d bytes,but written_len is %d!" %
                    (cmd_len, written_len))
                return ERR_DATA_UART_WRITE_FAIL
            '''
                mp response cmd{
                B      MP_START_BYTE(0x87)
                H      CmdID
                B      status
                I      payload_size (4 Bytes)
                H      read_back_len
                read_back_len*B  read back data
                H      crc16
                }
                read efuse reponse payload len is 4 Bytes
            '''

            pre_payload_len = struct.calcsize("<BHBI")

            rsp_cmd_fmt = "<BHBI%dBH" % (to_read_len + 2)
            rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
            zero_rsp_cmd_size = struct.calcsize("<BHBIHH")
            authen_fail_rsp_size = struct.calcsize("<BHBIH")
            self._serialHdl.set_read_timeout(1)

            rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
            self._serialHdl.reset_read_timeout()

            if len(rev_buf) == rsp_cmd_fmt_size or \
                    len(rev_buf) == zero_rsp_cmd_size or \
                    len(rev_buf) == authen_fail_rsp_size:
                start_flag, cmdIdRsp, = struct.unpack_from("<BH", rev_buf, 0)
                if start_flag != MP_START_BYTE:
                    LOG_FATAL("Error: read efuse fail for the invalid start flag 0x%x" % start_flag)
                    return ERR_REV_INVALID_START_FLAG

                expected_rsp_id = cmdid
                if cmdIdRsp != expected_rsp_id:
                    LOG_DEBUG(list(rev_buf))
                    LOG_FATAL(
                        "Fatal: wait for read efuse response,but rev the rsp cmd code 0x%x" % cmdIdRsp)
                    return ERR_REV_UNEXPECTED_RSP_CMD_CODE

                if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                    LOG_FATAL("Fatal:read efuse response crc checking fail")
                    LOG_DEBUG(list(rev_buf))
                    return ERR_CRC_CHK_FAIL
                else:
                    STATUS_OFFSET = struct.calcsize("<BH")
                    status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                    if status == 0:
                        read_back_len, = struct.unpack_from("<H", rev_buf, pre_payload_len)
                        read_back_data = rev_buf[pre_payload_len + 2:pre_payload_len + 2 + read_back_len]

                        read_efuse_buf += read_back_data

                        LOG_CRITICAL("read efuse addr 0x%x size 0x%x:" % (to_read_address, to_read_len))
                        LOG_CRITICAL("{}".format(bytes(read_back_data).hex()))
                        continue
                        #return read_back_data
                    else:
                        LOG_ERR("Error: read efuse status 0x%x" % status)
                        return ERR_DATA_UART_STATUS_FAIL
            else:
                LOG_ERR("Error: to read efuse rsp 0x%x bytes but read 0x%x bytes" % (rsp_cmd_fmt_size, len(rev_buf)))
                return ERR_DATA_UART_READ_FAIL
        return read_efuse_buf

    def __generate_write_efuse_data(self, cmd_code, addr,  data_buf, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        '''
        B  start byte
        H  cmd code
        B  bank   fixed 0
        H  addr
        H  size
        B*size data
        H  crc
        '''
        size = len(data_buf)
        cmd_buf_part1_fmt = "<BHBHH%dB" % size
        bank = 0
        cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt,
                                    MP_START_BYTE,
                                    cmd_code,
                                    bank,
                                    addr,
                                    size,
                                    *data_buf)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (cmd_buf_part1_size + cmd_buf_part2_size)

    def write_efuse_data(self, addr, data_buf):
        cmd_buf = []
        if type(data_buf) == str:
            bytes_data = bytes.fromhex(data_buf)
            data_buf = [d for d in bytes_data]

        size = len(data_buf)
        cmd_len = self.__generate_write_efuse_data(CmdID.CMD_WRITE_EFUSE_DATA.value, addr, data_buf, cmd_buf)

        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        LOG_CRITICAL(
            "write efuse request:{}".format(",".join([hex(n)[2:].upper() for n in list(cmd_buf)])))

        if written_len != cmd_len:
            LOG_ERR(
                "Error: write efuse data to send %d bytes,but written_len is %d!" %
                (cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size (4 Bytes)
            H      read_bank_len     
            H      crc16
            }
            write efuse reponse payload len is 4 Bytes
        '''
        pre_payload_len = struct.calcsize("<BHBI")
        rsp_cmd_fmt = "<BHBIHH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        authen_fail_rsp_size = struct.calcsize("<BHBIH")

        self._serialHdl.set_read_timeout(1)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        LOG_CRITICAL(
            "write efuse response:{}".format(",".join([hex(n)[2:].upper() for n in list(rev_buf)])))
        self._serialHdl.reset_read_timeout()

        if len(rev_buf) == rsp_cmd_fmt_size or \
                len(rev_buf) == authen_fail_rsp_size:
            start_flag, cmdIdRsp, = struct.unpack_from("<BH", rev_buf, 0)
            if start_flag != MP_START_BYTE:
                LOG_FATAL("Error: write efuse fail for the invalid start flag 0x%x" % start_flag)
                return ERR_REV_INVALID_START_FLAG

            expected_rsp_id = CmdID.CMD_WRITE_EFUSE_DATA.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for write efuse response,but rev the rsp cmd code 0x%x" % cmdIdRsp)
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE

            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_FATAL("Fatal:write efuse response crc checking fail")
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    write_efuse_len, = struct.unpack_from("<H", rev_buf, pre_payload_len)
                    if write_efuse_len == size:
                        LOG_CRITICAL("write efuse addr 0x%x size 0x%x successfully!" % (addr, size))
                        return ERR_OK
                    else:
                        LOG_CRITICAL("write efuse addr 0x%x size 0x%x, but really written size is 0x%x" % (
                        addr, size, write_efuse_len))
                        return ERR_EFUSE_WRITTEN_LEN_MISMATCH
                else:
                    LOG_ERR("Error: write efuse status 0x%x" % status)
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR(
                "Error: to read CMD_WRITE_EFUSE_DATA rsp 0x%x bytes but read 0x%x bytes" % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def __generate_flash_init_cmd(self, cmd_code, cmd_buf):

        cmd_fmt = "<BH"
        part1_fmt_size = struct.calcsize(cmd_fmt)
        cmd_buf_part1 = struct.pack(cmd_fmt, MP_START_BYTE, cmd_code)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (part1_fmt_size + part2_fmt_size)

    def flash_init(self):
        if self._has_get_flash_type == False:
            ret = self.get_flash_type()
            if ret != ERR_OK:
                return ret

        if self.flash_type in [FLASH_TYPE.FLASH_NOR_TYPE.value, FLASH_TYPE.FLASH_NAND_TYPE.value]:
            #return self.flash_init_for_flash()

            ret =self.flash_init_for_flash()

            if ret != ERR_OK:
                return ret
            elif self.flash_type == FLASH_TYPE.FLASH_NAND_TYPE.value:
                ret = self.get_nand_flash_block_size()
                return ret

            return ret
        else:
            return self.sd_init()
    def flash_init_for_flash(self):
        cmd_buf = []
        cmd_len = self.__generate_flash_init_cmd(CmdIDV2.CMD_FLASH_INIT.value, cmd_buf)

        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            return ERR_DATA_UART_WRITE_FAIL

        '''
          mp response cmd{
          B      MP_START_BYTE(0x87)
          H      CmdID
          B      status
          I      payload_size
          payload_size*B  payload (if payload_size is 0,it is without payload)
          H      crc16
          }
          efuse burn reponse payload len is 0 
        '''

        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CmdIDV2.CMD_FLASH_INIT.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL("Fatal: wait for CMD_FLASH_INIT response,but rev cmd code 0x%x" % (
                    cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("flash init OK!")
                    self.update_cfg_for_nand_flash()
                    return ERR_OK
                else:
                    LOG_ERR("Error: flash init fail,status 0x%x." % status)
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR("Error: flash init rev timeout,need %d bytes,read %d bytes." % (
                rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def flash_io_ctrl_test(self,io_ctrl_id,p1,p2,p3):
        cmd_buf = []
        cmd_len = self.__generator_flash_ioctl(CmdID.CMD_FLASH_IO_CTRL.value,
                                        io_ctrl_id,
                                        p1,
                                        p2,
                                        p3,
                                        cmd_buf)
        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            LOG_ERR("Error: uart flash init to send %d bytes,but written_len is %d!" % (
            cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size
            payload_size*B  payload (if payload_size is 0,it is without payload)
            H      crc16
            }
            flash init reponse payload len is 4
          '''
        rx_payload_len_fmt = "<BHBI"
        rx_payload_len_size = struct.calcsize(rx_payload_len_fmt)
        rx_payload_len_buf = self._serialHdl.read(rx_payload_len_size)
        payload_len, = struct.unpack_from("<I", rx_payload_len_buf, 4)

        rx_payload_buf = self._serialHdl.read(payload_len + 2)
        rev_buf = rx_payload_len_buf + rx_payload_buf

        rsp_cmd_fmt_size = struct.calcsize("<BHBI{}BH".format(payload_len))
        LOG_CRITICAL(rev_buf)
        LOG_CRITICAL("flash io ctrl rsp:{}".format(",".join([hex(n)[2:].upper() for n in list(rev_buf)])))

        if len(rev_buf) == rsp_cmd_fmt_size or len(rev_buf) == 10:
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                RSP_CMD_ID_OFFSET = 1
                rsp_cmd_id, = struct.unpack_from("<H", rev_buf, RSP_CMD_ID_OFFSET)
                expected_id = CmdID.CMD_FLASH_IO_CTRL.value
                if rsp_cmd_id != expected_id:
                    LOG_ERR("Error: wait for response command id 0x%04x, but get 0x%04x" % \
                            (expected_id, rsp_cmd_id))
                    return ERR_REV_UNEXPECTED_RSP_CMD_CODE

                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    RESULT_OFFSET = 12
                    io_ctrl_cmd, result, ext_len, = struct.unpack_from("<III", rev_buf, RESULT_OFFSET)
                    if result == 0:
                        LOG_CRITICAL("flash io ctrl 0x{:x} OK!".format(io_ctrl_cmd))
                        return ERR_OK
                    else:
                        LOG_ERR(
                            "Error: flash io ctrl 0x{:x} status is 0,but result is 0x{:x}".format(io_ctrl_cmd, result))
                        return ERR_DATA_UART_FLASH_INIT_FAIL
                else:
                    LOG_ERR("Error: flash io ctrl fail,status 0x{:x}".format(status))
                    return ERR_DATA_UART_FLASH_INIT_FAIL
        else:
            LOG_ERR("Error: flash io ctrl timeout,need %d bytes,read %d bytes." % \
                    (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

    def _flash_io_ctrl_init(self):
        cmd_buf = []
        cmd_len = self.__generator_flash_ioctl(CmdID.CMD_FLASH_IO_CTRL.value,
                                        FLASH_NOR_IOCTL_TYPE.FLASH_NOR_EXEC_FLASH_INIT.value,
                                        0,
                                        0,
                                        0,
                                        cmd_buf)
        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            LOG_ERR("Error: uart flash init to send %d bytes,but written_len is %d!" % (
            cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size
            payload_size*B  payload (if payload_size is 0,it is without payload)
            H      crc16
            }
            flash init reponse payload len is 4
          '''

        rsp_cmd_fmt = "<BHBIIIIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) == rsp_cmd_fmt_size:
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                RSP_CMD_ID_OFFSET = 1
                rsp_cmd_id, = struct.unpack_from("<H", rev_buf, RSP_CMD_ID_OFFSET)
                expected_id = CmdID.CMD_FLASH_IO_CTRL.value
                if rsp_cmd_id != expected_id:
                    LOG_ERR("Error: wait for response command id 0x%04x, but get 0x%04x" % \
                            (expected_id, rsp_cmd_id))
                    return ERR_REV_UNEXPECTED_RSP_CMD_CODE

                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    RESULT_OFFSET = 8
                    result, = struct.unpack_from("<I", rev_buf, RESULT_OFFSET)
                    if result == 27:  #FLASH_NOR_RET_SUCCESS=27
                        LOG_CRITICAL("flash init OK!")
                        return ERR_OK
                    else:
                        LOG_ERR(
                            "Error: flash init status is 0,but result is 0x%x" % result)
                        LOG_CRITICAL(rev_buf)
                        return ERR_DATA_UART_FLASH_INIT_FAIL
                else:
                    LOG_ERR("Error: flash init fail,status %d." % status)
                    return ERR_DATA_UART_FLASH_INIT_FAIL
        else:
            LOG_ERR("Error: flash init timeout,need %d bytes,read %d bytes." % \
                    (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

    def flash_load_cfg(self):
        cmd_buf = []
        cmd_len = self.__generator_flash_ioctl(CmdID.CMD_FLASH_IO_CTRL.value,
                                        FLASH_NOR_IOCTL_TYPE.FLASH_NOR_EXEC_QUERY_INFO_LOADING.value,
                                        0,
                                        0,
                                        0,
                                        cmd_buf)
        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: uart flash load cfg to send %d bytes,but written_len is %d!" % (
                cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size
            payload_size*B  payload (if payload_size is 0,it is without payload)
            H      crc16
            }
            flash load cfg reponse payload len is 4
          '''
        pre_rsp_fmt = "<BHBI"
        pre_rsp_cmd_fmt_size = struct.calcsize(pre_rsp_fmt)
        pre_rev_buf = self._serialHdl.read(pre_rsp_cmd_fmt_size)
        start_flag,cmd_code,st,data_len, = struct.unpack(pre_rsp_fmt,pre_rev_buf)
        if (start_flag == MP_START_BYTE) and \
           (cmd_code == CmdID.CMD_FLASH_IO_CTRL.value):
            sec_rsp_fmt = "<{}BH".format(data_len)
            sec_rsp_fmt_size = struct.calcsize(sec_rsp_fmt)
            sec_rsp_buf = self._serialHdl.read(sec_rsp_fmt_size)
            rev_buf = pre_rev_buf + sec_rsp_buf

        else:
            if start_flag != MP_START_BYTE:
                return ERR_REV_INVALID_START_FLAG
            else:
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE


        rsp_cmd_fmt = "<BHBI{}BH".format(data_len)
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)

        if len(rev_buf) == rsp_cmd_fmt_size:
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                RSP_CMD_ID_OFFSET = 1
                rsp_cmd_id, = struct.unpack_from("<H", rev_buf, RSP_CMD_ID_OFFSET)
                expected_id = CmdID.CMD_FLASH_IO_CTRL.value
                if rsp_cmd_id != expected_id:
                    LOG_ERR("Error: wait for response command id 0x%04x, but get 0x%04x" % \
                            (expected_id, rsp_cmd_id))
                    return ERR_REV_UNEXPECTED_RSP_CMD_CODE

                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    RESULT_OFFSET = 8
                    result, = struct.unpack_from("<I", rev_buf, RESULT_OFFSET)
                    if result == FLASH_NOR_RET_SUCCESS:  #FLASH_NOR_RET_SUCCESS=27
                        LOG_CRITICAL("flash load cfg OK!")
                        return ERR_OK
                    else:
                        LOG_ERR(
                            "Error: flash load cfg status is 0,but result is 0x%x" % result)
                        LOG_CRITICAL(rev_buf)
                        return ERR_DATA_UART_FLASH_LOAD_FAIL
                else:
                    LOG_ERR("Error: flash load cfg fail,status %d." % status)
                    return ERR_DATA_UART_FLASH_LOAD_FAIL
        else:
            LOG_ERR("Error: flash load cfg timeout,need %d bytes,read %d bytes." % \
                    (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL



    def __generator_flash_ioctl(self, cmd_code, flash_ioctl_cmd, param1, param2, param3,
                              cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BH4I"
        cmd_buf_part1_fmt_size = struct.calcsize(cmd_buf_part1_fmt)

        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, flash_ioctl_cmd,
                                    param1, param2, param3)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_fmt_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (cmd_buf_part1_fmt_size + cmd_buf_part2_fmt_size)
    def __generate_exit_mp_loader_cmd(self, cmd_code, timeout_sec, cmd_buf):

        cmd_fmt = "<BHB"
        part1_fmt_size = struct.calcsize(cmd_fmt)
        cmd_buf_part1 = struct.pack(cmd_fmt, MP_START_BYTE, cmd_code, timeout_sec)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (part1_fmt_size + part2_fmt_size)
    def _data_uart_exit_mp_loader(self, mp_boot_type):
        cmd_buf = []
        cmd_len = self.__generate_exit_mp_loader_cmd(CmdID.CMD_EXIT_MP_LOADER.value,
                                             mp_boot_type,
                                             cmd_buf)

        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            return ERR_DATA_UART_WRITE_FAIL

        '''
          mp response cmd{
          B      MP_START_BYTE(0x87)
          H      CmdID
          B      status
          I      payload_size
          payload_size*B  payload (if payload_size is 0,it is without payload)
          H      crc16
          }
          efuse burn reponse payload len is 0 
        '''

        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CmdID.CMD_EXIT_MP_LOADER.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL("Fatal: wait for CMD_EXIT_MP_LOADER response,but rev cmd code 0x%x" % (
                    cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("exit mp loader OK!")
                    return ERR_OK
                else:
                    LOG_ERR("Error: CMD_EXIT_MP_LOADER fail,status %d." % status)
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR("Error: exit mp loader rev timeout,need %d bytes,read %d bytes." % (
                rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

    def exit_mp_loader(self,mp_boot_type=0):
        return self._data_uart_exit_mp_loader(mp_boot_type)
    def get_status_erase_before_program(self):
        if self._has_get_flash_type == False:
            ret = self.get_flash_type()
            if ret != ERR_OK:
                return True
        if self.flash_type in [FLASH_TYPE.FLASH_NOR_TYPE.value, FLASH_TYPE.FLASH_NAND_TYPE.value]:
            return True
        elif self.flash_type in [FLASH_TYPE.SD_NAND_TYPE.value, FLASH_TYPE.SD_EMMC_TYPE.value]:
            return False
        else:
            LOG_ERR("Error: get storage type invalid 0x%x" % self.flash_type)
            return True
    def get_flash_type(self):
        cmd_buf = []
        cmd_buf_part1_fmt = "<BH"
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, CMDIDV3.CMD_GET_FLASH_TYPE.value)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send get flash type command!")
            return ERR_DATA_UART_WRITE_FAIL

        rsp_cmd_fmt = "<BHBIBH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CMDIDV3.CMD_GET_FLASH_TYPE.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for get flash type response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len,flash_type, = struct.unpack_from("<BIB", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("get flash type {} ok".format(flash_type))
                    LOG_DEBUG("flash type info:{}".format(
                        ",".join([hex(n)[2:].upper() for n in list(rev_buf)])))
                    FLASH_TYPE_VALUE_OFFSET = struct.calcsize("<BHBI")

                    self.flash_type, = struct.unpack_from("<B", rev_buf, FLASH_TYPE_VALUE_OFFSET)
                    self._has_get_flash_type = True

                    #if self.flash_type in [FLASH_TYPE.SD_NAND_TYPE.value, FLASH_TYPE.SD_EMMC_TYPE.value]:
                    #    self.set_sd_base_addr(0x80000000)
                    ##test
                    #self.get_sd_base_addr()

                    #self.set_sd_base_addr(0x100000000)
                    #self.get_sd_base_addr()
                    #self.set_sd_base_addr(0)
                    #self.get_sd_base_addr()

                    return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: get flash type fail,status %d." % (status))
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR(
                "Error:get flash type receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def get_nand_flash_block_size(self):
        cmd_code = CMDIDV4.CMD_FLASH_GET_BLOCK_SIZE.value
        cmd_buf = []
        cmd_buf_part1_fmt = "<BHI"
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code,0)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send get nand flash block size command!")
            return ERR_DATA_UART_WRITE_FAIL

        rsp_cmd_fmt = "<BHBIIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for get nand flash block size response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len,nand_flash_block_size, = struct.unpack_from("<BII", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("get nand flash block size 0x{:x} ok".format(nand_flash_block_size))
                    LOG_DEBUG("get nand flash block size:{}".format(
                        ",".join([hex(n)[2:].upper() for n in list(rev_buf)])))
                    if nand_flash_block_size == 0:
                        return ERR_GET_BLOCK_SIZE_UNKNOWN
                    else:
                        self.nand_flash_block_size = nand_flash_block_size
                        return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: get flash type fail,status %d." % (status))
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR(
                "Error:get flash type receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def update_cfg_for_nand_flash(self):
        if self._has_get_flash_type == False:
            ret = self.get_flash_type()
            if ret != ERR_OK:
                return ret
        if self.flash_type == FLASH_TYPE.FLASH_NAND_TYPE.value:
            self._config.set_occd_img_addr(self.nand_flash_sys_cfg_addr)
            self._config.set_flash_size(self.nand_flash_size_max)
            self._config.set_flash_start_addr(self.nand_flash_start_addr)
        return ERR_OK
    def read(self, addr, rd_size, saveObj):
        if self._has_get_flash_type == False:
            ret = self.get_flash_type()
            if ret != ERR_OK:
                return ret
        if self.flash_type in [FLASH_TYPE.FLASH_NOR_TYPE.value, FLASH_TYPE.FLASH_NAND_TYPE.value]:
            return self.flash_read(addr, rd_size, saveObj)
            #return super(MPLoaderFor8763CV2, self).flash_read(addr,rd_size,saveObj)
        elif self.flash_type in [FLASH_TYPE.SD_NAND_TYPE.value, FLASH_TYPE.SD_EMMC_TYPE.value]:
            return self.sd_read(addr,rd_size,saveObj)
        else:
            LOG_ERR("Error: get storage type invalid 0x%x" %self.flash_type)
            return ERR_INVALID_PARAM
    def page_erase(self, addr, size):
        if self._has_get_flash_type == False:
            ret = self.get_flash_type()
            if ret != ERR_OK:
                return ret
        if self.flash_type == FLASH_TYPE.FLASH_NOR_TYPE.value:
            if self.is_parallel_cmd:
                return self.__flash_erase_v2_wrapper(addr, size)
                #return self.page_erase_v2(addr, size)
            else:
                return self.__flash_erase_v1_wrapper(addr, size)
                #return super(MPLoaderFor8763CV2, self).page_erase(addr,size)
        elif  self.flash_type == FLASH_TYPE.FLASH_NAND_TYPE.value:
            return self.block128_erase(addr,size)
        elif self.flash_type == FLASH_TYPE.SD_NAND_TYPE.value or self.flash_type == FLASH_TYPE.SD_EMMC_TYPE.value:
            if self.is_parallel_cmd :
                return self.sd_erase(addr,size)
            else:
                return self.sd_erase_single(addr,size)
        else:
            LOG_ERR("Error: get storage type invalid 0x%x" %self.flash_type)
            return ERR_INVALID_PARAM
    def verify(self, img_path, img_addr):
        if self._has_get_flash_type == False:
            ret = self.get_flash_type()
            if ret != ERR_OK:
                return ret
        if self.flash_type == FLASH_TYPE.FLASH_NOR_TYPE.value or \
            self.flash_type == FLASH_TYPE.FLASH_NAND_TYPE.value:
            if self.is_parallel_cmd:
                return self.verify_v2(img_path, img_addr)
            else:
                return self.flash_verify(img_path, img_addr)
        elif self.flash_type == FLASH_TYPE.SD_NAND_TYPE.value or \
             self.flash_type == FLASH_TYPE.SD_EMMC_TYPE.value:
            return self.sd_verify(img_path, img_addr)
        else:
            LOG_ERR("Error: get storage type invalid 0x%x" %self.flash_type)
            return ERR_INVALID_PARAM
    def program(self, dl_obj, dl_addr, dl_size):
        if self._has_get_flash_type == False:
            ret = self.get_flash_type()
            if ret != ERR_OK:
                return ret
        if self.flash_type == FLASH_TYPE.FLASH_NOR_TYPE.value or \
            self.flash_type == FLASH_TYPE.FLASH_NAND_TYPE.value:
            if self.is_parallel_cmd:
                return self.program_v2(dl_obj, dl_addr, dl_size)
            else:
                return self.flash_program(dl_obj, dl_addr, dl_size)
        elif self.flash_type == FLASH_TYPE.SD_NAND_TYPE.value or \
             self.flash_type == FLASH_TYPE.SD_EMMC_TYPE.value:
            if self.is_parallel_cmd:
                return self.sd_program(dl_obj, dl_addr, dl_size)
            else:
                return self.sd_program_single(dl_obj, dl_addr, dl_size)
        else:
            LOG_ERR("Error: get storage type invalid 0x%x" %self.flash_type)
            return ERR_INVALID_PARAM
    def __generate_block128_erase_cmd(self, cmd_code, addr, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []
        if cmd_code == CMDIDV4.CMD_FLASH_BLOCK256_ERASE_V2.value or \
            cmd_code == CMDIDV4.CMD_FLASH_BLOCK128_ERASE_V2.value:
            part1_fmt = "<BHIII"
            part1_fmt_size = struct.calcsize(part1_fmt)

            cmd_buf_part1 = struct.pack(part1_fmt, MP_START_BYTE, cmd_code, 8,addr, data_len)
        else:
            part1_fmt = "<BHII"
            part1_fmt_size = struct.calcsize(part1_fmt)

            cmd_buf_part1 = struct.pack(part1_fmt, MP_START_BYTE, cmd_code, addr, data_len)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (part1_fmt_size + part2_fmt_size)

    def nand_flash_block_erase_v2(self, addr, size):
        if size == 0:
            LOG_CRITICAL("erase size is 0. Don't need to erase any flash space.")
            return ERR_OK

        if self.nand_flash_block_size == 0:
            LOG_ERR("Error: please get nand flash block size after flash init!")
            return ERR_GET_BLOCK_SIZE_UNKNOWN
        elif self.nand_flash_block_size == 0x20000:
            cmd_code = CMDIDV4.CMD_FLASH_BLOCK128_ERASE_V2.value
            blk_size = 0x20000
        elif self.nand_flash_block_size == 0x40000:
            cmd_code = CMDIDV4.CMD_FLASH_BLOCK256_ERASE_V2.value
            blk_size = 0x40000

        blk_cnt = (size + blk_size -1)// blk_size
        PRINT_PERCENT = False
        if blk_cnt >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to erase address 0x%x size 0x%x" % (addr, size))

        blk_addr = addr
        erase_size = blk_size
        remain_size = size %blk_size
        self._serialHdl.set_read_timeout(5)

        cmd_buf = []
        if size <  blk_size:
            erase_size = size

        cmd_len = self.__generate_block128_erase_cmd(cmd_code,
                                            blk_addr,
                                            erase_size,
                                            cmd_buf)
        written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                    blk_addr, erase_size))
            return ERR_ERASE_FAIL
        last_erase_addr = blk_addr
        last_erase_size = erase_size

        for blk_idx in range(1,blk_cnt):
            cmd_buf = []
            if (blk_idx == blk_cnt -1) and (remain_size > 0):
                erase_size = remain_size
            else:
                erase_size = blk_size
            blk_addr += erase_size
            cmd_len = self.__generate_block128_erase_cmd(cmd_code,
                                                blk_addr,
                                                erase_size,
                                                cmd_buf)

            written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
                return ERR_ERASE_FAIL

            ret = self.__page_erase_read_rsp_v2(cmd_code,last_erase_addr,last_erase_size)
            if ret != ERR_OK:
                return ret

            last_erase_addr = blk_addr
            last_erase_size = blk_size

            if PRINT_PERCENT:
                if (blk_idx + 1) % (int(blk_cnt * 0.1)) == 0:
                    percent = (blk_idx + 1) / blk_cnt
                    LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                        blk_idx + 1,
                        blk_cnt,
                        percent))
                    if blk_idx + 1 == blk_cnt:
                        PRINT_PERCENT = False

        ret = self.__page_erase_read_rsp_v2(cmd_code,last_erase_addr, last_erase_size)
        if ret != ERR_OK:
            return ret

        if PRINT_PERCENT:
            if blk_idx + 1 == blk_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(blk_idx + 1,
                                                                     blk_cnt,
                                                                     (blk_idx + 1) / blk_cnt))

        self._serialHdl.reset_read_timeout()
        return ERR_OK

    def block128_erase(self, addr, size):
        return self.nand_flash_block_erase_v2(addr,size)

    def block128_erase_v1(self, addr, size):
        if size == 0:
            LOG_CRITICAL("erase size is 0. Don't need to erase any flash space.")
            return ERR_OK

        if self.nand_flash_block_size == 0:
            LOG_ERR("Error: please get nand flash block size after flash init!")
            return ERR_GET_BLOCK_SIZE_UNKNOWN
        elif self.nand_flash_block_size == 0x20000:
            cmd_code = CMDIDV3.CMD_BLOCK128_ERASE.value
            blk_size = 0x20000
        elif self.nand_flash_block_size == 0x40000:
            cmd_code = CMDIDV4.CMD_FLASH_BLOCK256_ERASE_V2.value
            blk_size = 0x40000

        #blk_size = 0x20000  # 128KB
        blk_cnt = size // blk_size
        if size % blk_size != 0:
            blk_cnt += 1
        PRINT_PERCENT = False
        if blk_cnt >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to erase address 0x%x size 0x%x" % (addr, size))

        blk_addr = addr
        erase_size = blk_size
        self._serialHdl.set_read_timeout(5)
        for blk_idx in range(blk_cnt):
            cmd_buf = []
            cmd_len = self.__generate_block128_erase_cmd(cmd_code,
                                                blk_addr,
                                                erase_size,
                                                cmd_buf)

            try_times = self._config.CONFIG_ERASE_RETRY_MAX_TIMES
            is_retry = True

            while (is_retry and try_times > 0):
                try_times = try_times - 1
                if try_times != self._config.CONFIG_ERASE_RETRY_MAX_TIMES - 1:
                    LOG_CRITICAL("retry to erase %d (address 0x%x size 0x%x)" % (
                        self._config.CONFIG_ERASE_RETRY_MAX_TIMES - try_times, blk_addr,
                        erase_size))
                    time.sleep(1)

                written_len = self._serialHdl.write(cmd_buf, cmd_len)
                if written_len != cmd_len:
                    LOG_ERR(
                        "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                            blk_addr, erase_size))
                    continue

                '''
                mp response cmd{
                B      MP_START_BYTE(0x87)
                H      CmdID
                B      status
                I      payload_size
                payload_size*B  payload
                H      crc16
                }
                erase cmd without payload,payload_size is 0
                '''
                rsp_cmd_fmt = "<BHBIH"
                rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
                rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

                if len(rev_buf) == rsp_cmd_fmt_size:
                    cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
                    expected_rsp_id = cmd_code
                    if cmdIdRsp != expected_rsp_id:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: wait for block erase(address 0x%x size 0x%x) response,but rev rsp cmd code 0x%x" % (
                                blk_addr, erase_size, cmdIdRsp))
                        continue
                    if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                        LOG_DEBUG(list(rev_buf))
                        continue
                    else:
                        STATUS_OFFSET = struct.calcsize("<BH")
                        status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                        if status == 0:
                            is_retry = False
                            LOG_DEBUG("erase block(address 0x%x size 0x%x) ok" % (
                                blk_addr, erase_size))
                        else:
                            LOG_DEBUG(list(rev_buf))
                            LOG_ERR(
                                "Error: erase block(address 0x%x size 0x%x) fail,status 0x%x." % (
                                    blk_addr, erase_size, status))
                            if status == 0x36:   #MP_STATUS_ADDR_RANGE_CHK_FAIL
                                LOG_ERR("    erase page size is out of flash range!")
                                break
                            continue

                else:
                    LOG_ERR(
                        "Error:erase block(address 0x%x size 0x%x) receive timeout!need %d bytes,read %d bytes." % (
                            addr, size, rsp_cmd_fmt_size, len(rev_buf)))
                    continue

            add_erase_retry_times(self._config.CONFIG_ERASE_RETRY_MAX_TIMES - try_times - 1)

            if is_retry == True:
                self._serialHdl.reset_read_timeout()
                return ERR_ERASE_FAIL
            else:
                blk_addr += blk_size
                if PRINT_PERCENT:
                    if (blk_idx + 1) % (int(blk_cnt * 0.1)) == 0:
                        percent = (blk_idx + 1) / blk_cnt
                        LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                            blk_idx + 1,
                            blk_cnt,
                            percent))
                        if blk_idx + 1 == blk_cnt:
                            PRINT_PERCENT = False

                continue
        if PRINT_PERCENT:
            if blk_idx + 1 == blk_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(blk_idx + 1,
                                                                     blk_cnt,
                                                                     (blk_idx + 1) / blk_cnt))

        self._serialHdl.reset_read_timeout()
        return ERR_OK
    def run_into_mp_loader(self):
        if not self.__mp_loader_waiting_for_connect():
            LOG_ERR("Error: fail to run into mp loader!")
            return ERR_RUN_INTO_MP_LOADER
        return ERR_OK
    def __mp_loader_waiting_for_connect(self):
        read_timeout_ms = self._config.CONFIG_HANDSHAKE_READ_TIMEOUT_MS
        total_wait_s = self._config.CONFIG_HANDSHAKE_TIMEOUT_S
        threads = []

        self._serialHdl.set_read_timeout(read_timeout_ms / 1000)
        LOG_CRITICAL("please wait for connection...")
        log.stop_log()

        self.__reset()
        self._sync_event = threading.Event()
        SIGINT_hdl = signal.getsignal(signal.SIGINT)
        SIGTERM_hdl = signal.getsignal(signal.SIGTERM)
        signal.signal(signal.SIGINT,self._stop_thread)
        signal.signal(signal.SIGTERM, self._stop_thread)

        handshake_timer = threading.Timer(total_wait_s, self._handshake_timer)
        self._send_handshake_thread_hdl = threading.Thread(
            target=self.__send_handshake,
           daemon=True)
        threads.append(self._send_handshake_thread_hdl)

        self._check_rsp_thread_hdl = threading.Thread(
            target=self.__check_handshake_rsp,
            daemon=True)
        threads.append(self._check_rsp_thread_hdl)

        handshake_timer.start()
        self._send_handshake_thread_hdl.start()
        self._check_rsp_thread_hdl.start()

        self._thread_join(threads)

        self._sync_event.clear()
        handshake_timer.cancel()
        sys.stdout.write("\n")
        sys.stdout.flush()
        log.start_log()

        self._serialHdl.reset_read_timeout()

        # clear UART tx/rx buffer
        time.sleep(0.2)
        self._serialHdl.clear_trx_buf()
        signal.signal(signal.SIGINT, SIGINT_hdl)
        signal.signal(signal.SIGTERM, SIGTERM_hdl)
        return self._handshake_rst

    def __send_handshake(self):
        handshake_type = self.get_handshake_type()

        handshake_func = None
        if handshake_type == HANDSHAKE_TYPE.RUN_MP_LOADER:
            handshake_func = self._send_run_mp_load

        elif handshake_type == HANDSHAKE_TYPE.RUN_HCI_MODE.value:
            handshake_func = self.__send_run_hci_mode

        point_cnt = 0
        while(not self._stop_handshake):
            if handshake_func() != ERR_OK:
                LOG_ERR("Error: fail to send handshake request!")
                self._stop_handshake = True
                return False
            else:
                if self._sync_event.isSet() == False:
                    self._sync_event.set()
                sys.stdout.write(".")
                point_cnt += 1
                if point_cnt % 60 == 0:
                    sys.stdout.write("\r\n")
                sys.stdout.flush()
                time.sleep(0.005)
                #time.sleep(0.2)

    def __send_run_hci_mode(self):
        cmd_buf = []
        if len(self._handshake_request_buf) == 0:
            cmd_len = self._generate_run_mp_loader_cmd(CmdID.CMD_RUN_HCI_MODE.value,
                                                       self._config.CONFIG_MP_LOADER_LOG_ENABLE,
                                                       cmd_buf)
            self._handshake_request_buf = cmd_buf

        else:
            cmd_buf = self._handshake_request_buf
            cmd_len = len(cmd_buf)

        '''don't clear tx/rx buffer before send run hci mode request'''
        written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR("Error: run hci mode to send %d bytes,but written_len is %d!" % (
            cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        return ERR_OK

    def __check_handshake_rsp(self):
        '''
                mp response cmd{
                B      MP_START_BYTE(0x87)
                H      CmdID
                B      status
                I      payload_size
                payload_size*B  payload
                H      crc16
                }
        '''
        rsp_hdr_size = struct.calcsize("<BHBI")
        rsp_tail_size = struct.calcsize("<H")
        RSP_CHECK_SIZE = struct.calcsize("<BH")

        parse_step1 = True
        parse_step2 = False

        MAX_PAYLOAD_LEN = 2
        HANDSHAKE_RSP_MAX_SIZE = struct.calcsize("<BHBI{}BH".format(MAX_PAYLOAD_LEN))

        while not self._stop_handshake and \
                not self._sync_event.isSet():
            self._sync_event.wait(0.005)

        cmd_code, = struct.unpack_from("<H", bytearray(self._handshake_request_buf), 1)

        LOG_CRITICAL("handshake request:{}".format(",".join([hex(n)[2:].upper() for n in list(self._handshake_request_buf)])))

        REQ_CMD_LEN = len(self._handshake_request_buf)

        while not self._stop_handshake:
            rev_buf = self._serialHdl.read()

            if len(rev_buf) > 0:
                LOG_CRITICAL(
                    "{}".format(",".join([hex(n)[2:].upper() for n in list(rev_buf)])))

            self._cache_handshake_data += list(rev_buf)

            rev_len = len(self._cache_handshake_data)

            # check app cli echo
            if rev_len >= REQ_CMD_LEN:
                check_list = [
                    self._handshake_request_buf == list(self._cache_handshake_data)[i:i + REQ_CMD_LEN] \
                    for i in range(0, rev_len - REQ_CMD_LEN + 1)]

                if any(check_list):
                    LOG_CRITICAL(
                        '''Note: receive handshake cli echo.The application cli is running!\r\n please reset the device manually!''')
                    skip_idx = 0
                    for idx,val in enumerate(check_list):
                        if val == True:
                            skip_idx = idx + REQ_CMD_LEN
                        else:
                            continue

                    #skip requset command echo
                    self._cache_handshake_data = self._cache_handshake_data[skip_idx:]
                    rev_len = len(self._cache_handshake_data)

                    if rev_len < HANDSHAKE_RSP_MAX_SIZE:
                        continue
                    else:
                        #continue to parse response
                        pass
                else:
                    pass

            #check handshake response
            if rev_len >= rsp_hdr_size:
                check_hdr_data = self._handshake_request_buf[0:RSP_CHECK_SIZE] #0x87 + command code(2bytes)
                check_data_len = len(check_hdr_data)
                check_list = [check_hdr_data == list(self._cache_handshake_data)[i:i + check_data_len] \
                    for i in range(0, rev_len - check_data_len + 1)]

                if any(check_list) == False:
                    #skip invalid data
                    self._cache_handshake_data = self._cache_handshake_data[-(RSP_CHECK_SIZE-1):]
                    rev_len = len(self._cache_handshake_data)
                    continue
                else:
                    skip_idx = 0
                    for idx,val in enumerate(check_list):
                        if val == False:
                            continue
                        else:
                            skip_idx = idx
                            if len(self._cache_handshake_data[idx:]) >= rsp_hdr_size:
                                start_flag, oper_code, status, payload_len = struct.unpack_from(
                                    "<BHBI", bytes(self._cache_handshake_data[idx:]))

                                if payload_len <= MAX_PAYLOAD_LEN:
                                    cmd_len = rsp_hdr_size + payload_len + rsp_tail_size
                                else:
                                    #invalid payload_len, to check next rsp header
                                    LOG_ERR("Error: check handshake response payload length 0x%x invalid".format(payload_len))
                                    LOG_ERR("  continue to wait the valid response, maybe you can reset the device to try again!")
                                    skip_idx = idx + RSP_CHECK_SIZE
                                    continue

                                #to check the entire response data crc
                                if len(self._cache_handshake_data[idx:]) >= cmd_len:
                                    crc_valid = self.cmd_crc_check(bytes(self._cache_handshake_data[idx:idx + cmd_len]),
                                                                   cmd_len)
                                    if crc_valid != ERR_OK:
                                       LOG_ERR("Error: check handshake response crc invalid!")
                                       LOG_ERR("  continue to wait the valid response, maybe you can reset the device to try again!")
                                       skip_idx = idx + RSP_CHECK_SIZE
                                       continue
                                    else:
                                        if status != 0:
                                            LOG_ERR("Error: check handshake response status 0x%x fail!".format(status))
                                            LOG_ERR("  Please reset the device to try again!")
                                            skip_idx = idx + RSP_CHECK_SIZE
                                            continue
                                        else:
                                            #check handshake response
                                            if oper_code == CmdID.CMD_RUN_MP_LOADER.value:
                                                if payload_len == 0:
                                                    LOG_CRITICAL("run into mp loader through two wire UART ok!")
                                                    self._handshake_rst = True
                                                    break
                                                elif payload_len == 1 or payload_len == 2:
                                                    WIRE_MODE_OFFSET = struct.calcsize("<BHBI")

                                                    wire_mode, = struct.unpack_from("<B", bytes(self._cache_handshake_data[idx:]),
                                                                                    WIRE_MODE_OFFSET)

                                                    if wire_mode == SINGLE_WIRE_MODE:
                                                        self._config.set_packet_size(self._config.CONFIG_SINGLE_WIRE_UART_PKT_SIZE)
                                                        self._handshake_rst = True
                                                        self.set_wire_mode(SINGLE_WIRE_MODE)

                                                        LOG_CRITICAL("run into mp loader through single wire UART ok!")
                                                    elif wire_mode == TWO_WIRE_MODE:
                                                        self._config.set_packet_size(
                                                            self._config.CONFIG_TWO_WIRE_UART_PKT_SIZE)
                                                        self._handshake_rst = True
                                                        self.set_wire_mode(TWO_WIRE_MODE)

                                                        LOG_CRITICAL("run into mp loader through two wire UART ok!")
                                                    elif wire_mode == USB_DEV_MODE:
                                                        self._config.set_packet_size(self._config.CONFIG_TWO_WIRE_UART_PKT_SIZE)
                                                        self._handshake_rst = True
                                                        self.set_wire_mode(USB_DEV_MODE)

                                                        LOG_CRITICAL("run into mp loader through USB ok!")
                                                    else:
                                                        LOG_ERR(
                                                            "Error: get unknown wire mode %d in mp loader handshake response" % wire_mode)
                                                        LOG_ERR("  Please reset the device to try again!")
                                                        skip_idx = idx + RSP_CHECK_SIZE
                                                        continue

                                                    if payload_len == 2:
                                                        ACCSEE_FLAG_OFFSET = struct.calcsize("<BHBIB")
                                                        access_flag, = struct.unpack_from("<B",
                                                                                          bytes(self._cache_handshake_data),
                                                                                          ACCSEE_FLAG_OFFSET)
                                                        LOG_CRITICAL("Access Flag 0x%x" % access_flag)

                                                        if wire_mode == TWO_WIRE_MODE and ((access_flag>>5)&0x3) == 0: #uart polling mode
                                                            self.is_parallel_cmd = False

                                                    break
                                                else:
                                                    LOG_ERR(
                                                        "Error: payload len(0x%x) in CMD_RUN_MP_LOADER response isn't supported!" % payload_len)
                                                    LOG_ERR("  Please reset the device to try again!")
                                                    skip_idx = idx + RSP_CHECK_SIZE
                                                    continue
                                            elif oper_code == CmdID.CMD_RUN_HCI_MODE.value:
                                                if payload_len == 1:
                                                    EFUSE_STATUS_OFFSET = struct.calcsize("<BHBI")
                                                    EFUSE_VALID = 0
                                                    EFUSE_INVALID = 1
                                                    efuse_status, = struct.unpack_from("<B",
                                                                                       bytes(self._cache_handshake_data),
                                                                                       EFUSE_STATUS_OFFSET)
                                                    if efuse_status == EFUSE_VALID:
                                                        self._handshake_rst = True
                                                        LOG_CRITICAL("run into hci mode ok, efuse valid!")
                                                        break
                                                    elif efuse_status == EFUSE_INVALID:
                                                        self._handshake_rst = True
                                                        LOG_CRITICAL("run into hci mode ok, efuse invalid!")
                                                        break
                                                    else:
                                                        LOG_ERR(
                                                            "Error: get unknown efuse status %d in run into hci mode handshake response" %
                                                            efuse_status)
                                                        LOG_ERR("  Please reset the device to try again!")
                                                        skip_idx = idx + RSP_CHECK_SIZE
                                                        continue

                                                else:
                                                    LOG_ERR(
                                                        "Error: payload len(0x%x) in CMD_RUN_HCI_MODE response should be 1 byte!" % payload_len)
                                                    LOG_ERR("  Please reset the device to try again!")
                                                    skip_idx = idx + RSP_CHECK_SIZE
                                                    continue
                                            else:
                                                #can not run here
                                                LOG_ERR("Error: invalid handshake response command code 0x%x".format(oper_code))
                                                skip_idx = idx + RSP_CHECK_SIZE
                                                continue
                                else:
                                    #need more data
                                    break
                            else:
                                #need more data
                                break

                    if self._handshake_rst == False:
                        self._cache_handshake_data = self._cache_handshake_data[skip_idx:]
                        rev_len = len(self._cache_handshake_data)
                        continue
                    else:
                        self._cache_handshake_data = []
                        time.sleep(0.01)
                        break

            else:
                #need more data
                continue

        self._stop_handshake = True

    def __check_flash_cmd_rsp_v2(self,req_cmd_id, req_addr, req_size):
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size
            payload_size*B  payload
            (|fixed payload length(4B)|addr (4B) | size (4B) | ext payload length (4B)| ext payload )
            H      crc16
            }
            program reponse payload len is 0
         '''
        rsp_cmd_fmt = "<BHBI5IH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        #LOG_CRITICAL(list(rev_buf))

        if len(rev_buf) > 8:
            rx_cmd_id,status,payload_len, = struct.unpack_from("<HBI", rev_buf, 1)
            if status != 0 and payload_len == 0:
                cmd_rsp_size = 10
            else:
                cmd_rsp_size = 30
        else:
            LOG_ERR("Error: read rsp data %d bytes less than 8 bytes for cmd 0x%02x" %(len(rev_buf),req_cmd_id))
            return ERR_DATA_UART_READ_FAIL

        if len(rev_buf) != cmd_rsp_size:
            LOG_ERR("Error: read rsp for cmd 0x%02x, need %d bytes but receive %d bytes" %(req_cmd_id, cmd_rsp_size,len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

        if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
            LOG_DEBUG(list(rev_buf))
            LOG_FATAL(
                "Fatal: check rsp for 0x%02x (address 0x%x size 0x%x) crc checking fail!" % (
                    req_cmd_id,req_addr, req_size))
            return ERR_CRC_CHK_FAIL

        if rx_cmd_id != req_cmd_id:
            LOG_FATAL(
                "Fatal: check flash cmd rsp for cmd 0x%02x but receive rsp for cmd 0x%02x!" % (
                    req_cmd_id,rx_cmd_id))
            return ERR_REV_UNEXPECTED_RSP_CMD_CODE

        if status != 0:
            LOG_DEBUG(list(rev_buf))
            LOG_ERR(
                "Error: check flash cmd rsp (address 0x%08X size 0x%x) fail,status %d." % (
                    req_addr, req_size, status))
            return ERR_STATUS_AUTH_FAIL
        else:
            STATUS_OFFSET = struct.calcsize("<BH")
            status,payload_len,fix_payload_len,addr_rx,size_rx,flash_status,ext_payload_len, = struct.unpack_from("<B6I", rev_buf, STATUS_OFFSET)

            if req_addr == addr_rx and req_size == size_rx:
                LOG_DEBUG("check flash cmd rsp (address 0x%x size 0x%x) ok" % (
                    req_addr, req_size))
                return ERR_OK
            else:
                LOG_DEBUG("Error: check flash cmd rsp (address 0x%x size 0x%x), but rx rsp (address 0x%x size 0x%x)" % (
                    req_addr, req_size,addr_rx,size_rx))

                rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
                LOG_DEBUG(list(rev_buf))
                return ERR_REV_UNEXPECTED_PARALLEL_RSP_INFO



    def __read_program_rsp_v2(self, dl_addr, dl_size):
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size
            payload_size*B  payload
            H      crc16
            }
            program reponse payload len is 0
         '''

        rsp_cmd_fmt = "<BHBI5IH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CMDIDV4.CMD_FLASH_PROGRAM_V2.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for program rsp(address 0x%x size 0x%x),but receive the response cmd code 0x%x" % (
                        dl_addr, dl_size, cmdIdRsp))
                return False
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: program rsp (address 0x%x size 0x%x) crc checking fail!" % (
                        dl_addr, dl_size))
                return False
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len,fix_payload_len,addr_rx,size_rx,flash_status,ext_payload_len, = struct.unpack_from("<B6I", rev_buf, STATUS_OFFSET)
                if status == 0:
                    if dl_addr == addr_rx and dl_size == size_rx:
                        LOG_DEBUG("Program (address 0x%x size 0x%x) ok" % (
                            dl_addr, dl_size))
                        return True
                    else:
                        LOG_DEBUG("Error: program (address 0x%x size 0x%x), but rx program rsp (address 0x%x size 0x%x)" % (
                            dl_addr, dl_size,addr_rx,size_rx))
                        return False
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: program (address 0x%08X size 0x%x) fail,status %d, flash status %d" % (
                            dl_addr, dl_size, status, flash_status))
                    return False

        else:
            LOG_ERR(
                "Error:rev program rsp (address 0x%x size 0x%x)timeout!need %d bytes,read %d bytes." % (
                    dl_addr, dl_size, rsp_cmd_fmt_size, len(rev_buf)))
            return False
    def __generate_program_v2(self, cmd_code, addr, data_buf, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BHIII%dB" % data_len
        cmd_buf_part1_fmt_size = struct.calcsize(cmd_buf_part1_fmt)

        if len(data_buf) != data_len:
            LOG_ERR("Error: generate program need %d bytes,but only %d bytes!" % (
                data_len, len(data_buf)))
            return 0

        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, 8+data_len,addr,
                                    data_len, *data_buf)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_fmt_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (cmd_buf_part1_fmt_size + cmd_buf_part2_fmt_size)
    def __flash_program_fp_v2(self, address, data_len, fp):
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        #DATA_SIZE_PER_PACKET = 51
        pkt_num = data_len // DATA_SIZE_PER_PACKET
        if data_len % DATA_SIZE_PER_PACKET != 0:
            pkt_num += 1

        dl_addr = address
        dl_size = DATA_SIZE_PER_PACKET

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to program address 0x%x size 0x%x" % (address, data_len))
        self._serialHdl.set_read_timeout(1)

        # first packet
        if data_len < DATA_SIZE_PER_PACKET:
            dl_size = data_len
        cmd_buf = []
        cmd_len = self.__generate_program_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value,
                                          dl_addr,
                                          list(fp.read(dl_size)),
                                          dl_size,
                                          cmd_buf)
        if cmd_len == 0:
            LOG_ERR("Error:generate_program fail.")
            return ERR_GENERATE_CMD_FAIL

        written_len = self.serial_write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                    dl_addr, dl_size, cmd_len, written_len))
        else:
            LOG_DEBUG("program send request addr 0x%x  size 0x%x" % (dl_addr, dl_size))
        last_dl_addr = dl_addr
        last_dl_size = dl_size

        for pkt_idx in range(1, pkt_num):
            cmd_buf = []
            dl_addr += dl_size
            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET

            cmd_len = self.__generate_program_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value,
                                              dl_addr,
                                              list(fp.read(dl_size)),
                                              dl_size,
                                              cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_program fail.")
                return ERR_GENERATE_CMD_FAIL

            written_len = self.serial_write(cmd_buf, cmd_len, False)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        dl_addr, dl_size, cmd_len, written_len))
                continue
            else:
                LOG_DEBUG("program send request addr 0x%x  size 0x%x" %(dl_addr, dl_size))
            check_rsp_ret = self.__check_flash_cmd_rsp_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value,last_dl_addr, last_dl_size)
            if check_rsp_ret == ERR_OK:
                last_dl_addr = dl_addr
                last_dl_size = dl_size
                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG(
                            "\tprogram progress {}/{} {:.1%} ".format(
                                pkt_idx + 1,
                                pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
            else:
                return check_rsp_ret

        if self.__check_flash_cmd_rsp_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value,last_dl_addr, last_dl_size) != ERR_OK:
            return ERR_PROGRAM_RSP_FAIL

        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG(
                    "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
                                                              (pkt_idx + 1) / pkt_num))
        return ERR_OK
    def __flash_program_file_v2(self, img_path, img_addr, img_content_size):
        file_size = os.path.getsize(img_path)
        LOG_DEBUG("file size: %d,  download content length: %d" % (file_size, img_content_size))

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

                program_ret = self.__flash_program_fp_v2(img_addr, img_content_size, fp)
                #program_ret = self.__mp_program_paralell(img_addr, img_content_size, fp)
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
    def __flash_program_buf_v2(self, data_buf, address, data_len):
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        pkt_num = data_len // DATA_SIZE_PER_PACKET
        if data_len % DATA_SIZE_PER_PACKET != 0:
            pkt_num += 1

        dl_addr = address
        dl_size = DATA_SIZE_PER_PACKET

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to program address 0x%x size 0x%x" % (address, data_len))
        self._serialHdl.set_read_timeout(1)

        # first packet
        if data_len < DATA_SIZE_PER_PACKET:
            dl_size = data_len
        cmd_buf = []
        cmd_len = self.__generate_program_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value,
                                          dl_addr,
                                          data_buf[0: dl_size],
                                          dl_size,
                                          cmd_buf)
        if cmd_len == 0:
            LOG_ERR("Error:generate_program fail.")
            return ERR_GENERATE_CMD_FAIL

        written_len = self.serial_write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                    dl_addr, dl_size, cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        else:
            LOG_DEBUG("program send request addr 0x%x  size 0x%x" % (dl_addr, dl_size))


        last_dl_addr = dl_addr
        last_dl_size = dl_size

        for pkt_idx in range(1,pkt_num):
            cmd_buf = []
            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET

            cmd_len = self.__generate_program_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value,
                                              dl_addr,
                                              data_buf[(pkt_idx * DATA_SIZE_PER_PACKET):(
                                                      pkt_idx * DATA_SIZE_PER_PACKET + dl_size)],
                                              dl_size,
                                              cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_program fail.")
                return ERR_GENERATE_CMD_FAIL

            written_len = self.serial_write(cmd_buf, cmd_len, False)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        dl_addr, dl_size, cmd_len, written_len))
                return ERR_DATA_UART_WRITE_FAIL
            else:
                LOG_DEBUG("program send request addr 0x%x  size 0x%x" %(dl_addr, dl_size))

            check_rsp_ret = self.__check_flash_cmd_rsp_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value, last_dl_addr,
                                                          last_dl_size)
            if check_rsp_ret == ERR_OK:
                last_dl_addr = dl_addr
                last_dl_size = dl_size
                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG(
                            "\tprogram progress {}/{} {:.1%} ".format(
                                pkt_idx + 1,
                                pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
            else:
                return check_rsp_ret

        if self.__check_flash_cmd_rsp_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value, last_dl_addr, last_dl_size) != ERR_OK:
            return ERR_PROGRAM_RSP_FAIL

        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG(
                    "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
                                                              (pkt_idx + 1) / pkt_num))
        return ERR_OK
    def program_v2(self, dl_obj, dl_addr, dl_size):
        if dl_obj == None:
            return ERR_PROGRAM_OBJ_NONE

        if type(dl_obj) == str:
            return self.__flash_program_file_v2(dl_obj, dl_addr, dl_size)
        elif type(dl_obj) == list:
            return self.__flash_program_buf_v2(dl_obj, dl_addr, dl_size)
        else:
            raise Exception(
                "Error: don't support to program object type {}!".format(type(dl_obj)))
    def __page_erase_read_rsp_v2(self,check_cmd_id,blk_addr, erase_size):
        '''
        mp response cmd{
        B      MP_START_BYTE(0x87)
        H      CmdID
        B      status
        I      payload_size
        payload_size*B  payload
        H      crc16
        }
        erase cmd without payload,payload_size is 0
        '''
        rsp_cmd_fmt = "<BHBI5IH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = check_cmd_id
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for page erase(address 0x%x size 0x%x) response,but rev rsp cmd code 0x%x" % (
                        blk_addr, erase_size, cmdIdRsp))
                return ERR_ERASE_FAIL
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_ERASE_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len,fix_payload_len,addr_rx,size_rx,flash_status,ext_payload_len, = struct.unpack_from("<B6I", rev_buf, STATUS_OFFSET)
                if status == 0:
                    if blk_addr == addr_rx and erase_size == size_rx:
                        LOG_DEBUG("erase cmd 0x%x (address 0x%x size 0x%x) ok" % (cmdIdRsp,
                            blk_addr, erase_size))
                        return ERR_OK
                    else:
                        LOG_DEBUG("Error: erase cmd 0x%x (address 0x%x size 0x%x), but rx page erase rsp (address 0x%x size 0x%x)" % (
                            cmdIdRsp,blk_addr, erase_size,addr_rx,size_rx))
                        return ERR_ERASE_FAIL
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: erase cmd 0x%x (address 0x%x size 0x%x) fail,status 0x%x, flash status %d" % (cmdIdRsp,
                            blk_addr, erase_size, status, flash_status))
                    if status == 0x36:  # MP_STATUS_ADDR_RANGE_CHK_FAIL
                        LOG_ERR("    erase page size is out of flash range!")
                        return ERR_ERASE_FAIL
        else:
            LOG_ERR(
                "Error:erase 0x%x (address 0x%x size 0x%x) receive timeout!need %d bytes,read %d bytes." % (check_cmd_id,
                    blk_addr, erase_size, rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_ERASE_FAIL
    def __flash_erase_v1_wrapper(self,addr, size):
       Flash_nor_block_size = 0x10000
       if size < Flash_nor_block_size:
           return self.page_erase_single(addr,size)

       else:
           unaligned_addr = addr %Flash_nor_block_size
           unaligned_size = Flash_nor_block_size - addr %Flash_nor_block_size

           if unaligned_addr > 0 and unaligned_size > 0:
               ret = self.page_erase_single(addr,unaligned_size)
               if ret != ERR_OK:
                   return ret
               else:
                   size -= unaligned_size
                   addr += unaligned_size
           block_cnt = size//Flash_nor_block_size
           if block_cnt > 0:
               ret = self.__flash_block64_erase_v1(addr,block_cnt*Flash_nor_block_size)
               if ret != ERR_OK:
                   return ret
               size -= block_cnt*Flash_nor_block_size
               addr += block_cnt*Flash_nor_block_size

               # for i in range(block_cnt):
               #     ret = self.__flash_block64_erase(addr,Flash_nor_block_size)
               #     if ret != ERR_OK:
               #         return ret
               #     size -= Flash_nor_block_size
               #     addr += Flash_nor_block_size
           if size > 0:
               ret = self.page_erase_single(addr, size)
               if ret != ERR_OK:
                   return ret

           return ERR_OK
    def __flash_erase_v2_wrapper(self,addr, size):
       Flash_nor_block_size = 0x10000
       if size < Flash_nor_block_size:
           return self.page_erase_v2(addr,size)

       else:
           unaligned_addr = addr %Flash_nor_block_size
           unaligned_size = Flash_nor_block_size - addr %Flash_nor_block_size

           if unaligned_addr > 0 and unaligned_size > 0:
               ret = self.page_erase_v2(addr,unaligned_size)
               if ret != ERR_OK:
                   return ret
               else:
                   size -= unaligned_size
                   addr += unaligned_size
           block_cnt = size//Flash_nor_block_size
           if block_cnt > 0:
               ret = self.__flash_block64_erase(addr,block_cnt*Flash_nor_block_size)
               if ret != ERR_OK:
                   return ret
               size -= block_cnt*Flash_nor_block_size
               addr += block_cnt*Flash_nor_block_size

               # for i in range(block_cnt):
               #     ret = self.__flash_block64_erase(addr,Flash_nor_block_size)
               #     if ret != ERR_OK:
               #         return ret
               #     size -= Flash_nor_block_size
               #     addr += Flash_nor_block_size
           if size > 0:
               ret = self.page_erase_v2(addr, size)
               if ret != ERR_OK:
                   return ret

           return ERR_OK
    def __generate_erase_cmd(self, cmd_code, addr, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        part1_fmt = "<BHII"
        part1_fmt_size = struct.calcsize(part1_fmt)

        cmd_buf_part1 = struct.pack(part1_fmt, MP_START_BYTE, cmd_code, addr, data_len)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (part1_fmt_size + part2_fmt_size)
    def __flash_block64_erase_v1(self, addr, size):
        cmd_code = CMDIDV3.CMD_BLOCK64_ERASE.value

        cmd_buf = []
        cmd_len = self.__generate_erase_cmd(cmd_code,
                                            addr, size,
                                                cmd_buf)

        written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
            return ERR_ERASE_FAIL

        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size
            payload_size*B  payload
            H      crc16
            }
            erase cmd without payload,payload_size is 0
        '''
        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for block64 erase(address 0x%x size 0x%x) response,but rev rsp cmd code 0x%x" % (
                        addr, size, cmdIdRsp))
                return ERR_ERASE_FAIL

            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_ERASE_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:

                    LOG_DEBUG("erase block64 (address 0x%x size 0x%x) ok" % (
                        addr, size))
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: erase block64(address 0x%x size 0x%x) fail,status %d." % (
                            addr, size, status))
                    return ERR_ERASE_FAIL
        else:
            LOG_ERR(
                "Error:erase block64(address 0x%x size 0x%x) receive timeout!need %d bytes,read %d bytes." % (
                    addr, size, rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_ERASE_FAIL

        self._serialHdl.reset_read_timeout()
        return ERR_OK

    def __flash_block64_erase(self,addr, size):
        cmd_code = CMDIDV4.CMD_FLASH_BLOCK64_ERASE_V2.value
        blk_size = 8*0x10000  # 0x10000  # 64KB
        blk_cnt = (size + blk_size -1)// blk_size
        PRINT_PERCENT = False
        if blk_cnt >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to block64 erase address 0x%x size 0x%x" % (addr, size))

        blk_addr = addr
        erase_size = blk_size
        remain_size = size %blk_size
        self._serialHdl.set_read_timeout(5)

        if self.is_parallel_cmd:
            cmd_buf = []
            if size <  blk_size:
                erase_size = blk_size

            cmd_len = self.__generate_erase_cmd_v2(cmd_code,
                                                blk_addr,
                                                erase_size,
                                                cmd_buf)
            written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
                return ERR_ERASE_FAIL
            last_erase_addr = blk_addr
            last_erase_size = erase_size

        for blk_idx in range(1,blk_cnt):
            cmd_buf = []
            if (blk_idx == blk_cnt -1) and (remain_size > 0):
                erase_size = remain_size
            else:
                erase_size = blk_size
            if self.is_parallel_cmd:
                blk_addr += erase_size
            cmd_len = self.__generate_erase_cmd_v2(cmd_code,
                                                blk_addr,
                                                erase_size,
                                                cmd_buf)

            written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
                return ERR_ERASE_FAIL

            ret = self.__page_erase_read_rsp_v2(cmd_code,last_erase_addr,last_erase_size)
            if ret != ERR_OK:
                return ret
            else:
                if self.is_parallel_cmd:
                    last_erase_addr = blk_addr
                    last_erase_size = erase_size
                else:
                    blk_addr += erase_size

            if PRINT_PERCENT:
                if (blk_idx + 1) % (int(blk_cnt * 0.1)) == 0:
                    percent = (blk_idx + 1) / blk_cnt
                    LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                        blk_idx + 1,
                        blk_cnt,
                        percent))
                    if blk_idx + 1 == blk_cnt:
                        PRINT_PERCENT = False

        ret = self.__page_erase_read_rsp_v2(cmd_code,last_erase_addr, last_erase_size)
        if ret != ERR_OK:
            return ret

        if PRINT_PERCENT:
            if blk_idx + 1 == blk_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(blk_idx + 1,
                                                                     blk_cnt,
                                                                     (blk_idx + 1) / blk_cnt))

        self._serialHdl.reset_read_timeout()
        return ERR_OK
    def page_erase_v2(self, addr, size):
        cmd_code = CMDIDV4.CMD_FLASH_PAGE_ERASE_V2.value
        if size == 0:
            LOG_CRITICAL("erase size is 0. Don't need to erase any flash space.")
            return ERR_OK

        blk_size = 0x10000  # 64KB
        blk_cnt = (size + blk_size -1)// blk_size
        PRINT_PERCENT = False
        if blk_cnt >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to erase address 0x%x size 0x%x" % (addr, size))

        blk_addr = addr
        erase_size = blk_size
        remain_size = size %blk_size
        self._serialHdl.set_read_timeout(5)

        cmd_buf = []
        if size <  blk_size:
            erase_size = size

        cmd_len = self.__generate_erase_cmd_v2(cmd_code,
                                            blk_addr,
                                            erase_size,
                                            cmd_buf)
        written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                    blk_addr, erase_size))
            return ERR_ERASE_FAIL
        last_erase_addr = blk_addr
        last_erase_size = erase_size

        for blk_idx in range(1,blk_cnt):
            cmd_buf = []
            if (blk_idx == blk_cnt -1) and (remain_size > 0):
                erase_size = remain_size
            else:
                erase_size = blk_size
            blk_addr += erase_size
            cmd_len = self.__generate_erase_cmd_v2(cmd_code,
                                                blk_addr,
                                                erase_size,
                                                cmd_buf)

            written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
                return ERR_ERASE_FAIL

            ret = self.__page_erase_read_rsp_v2(cmd_code,last_erase_addr,last_erase_size)
            if ret != ERR_OK:
                return ret

            last_erase_addr = blk_addr
            last_erase_size = blk_size

            if PRINT_PERCENT:
                if (blk_idx + 1) % (int(blk_cnt * 0.1)) == 0:
                    percent = (blk_idx + 1) / blk_cnt
                    LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                        blk_idx + 1,
                        blk_cnt,
                        percent))
                    if blk_idx + 1 == blk_cnt:
                        PRINT_PERCENT = False

        ret = self.__page_erase_read_rsp_v2(cmd_code,last_erase_addr, last_erase_size)
        if ret != ERR_OK:
            return ret

        if PRINT_PERCENT:
            if blk_idx + 1 == blk_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(blk_idx + 1,
                                                                     blk_cnt,
                                                                     (blk_idx + 1) / blk_cnt))

        self._serialHdl.reset_read_timeout()
        return ERR_OK
    def __generate_erase_cmd_v2(self, cmd_code, addr, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        part1_fmt = "<BHIII"
        part1_fmt_size = struct.calcsize(part1_fmt)

        cmd_buf_part1 = struct.pack(part1_fmt, MP_START_BYTE, cmd_code, 8,addr, data_len)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (part1_fmt_size + part2_fmt_size)
    def __generate_flash_verify_cmd_v2(self, cmd_code, addr, data_len, orign_crc16,
                                    cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BHIIIH"
        cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, 10,addr,
                                    data_len,
                                    orign_crc16)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (cmd_buf_part1_size + cmd_buf_part2_size)
    def __calculate_verify_time_v2(self, data_len):
        verify_timeout = 40
        calc_timeout_s = ((data_len+0x100000-1)//0x100000)*6  # 1M bytes -> 5s
        if calc_timeout_s > 40:
            verify_timeout = calc_timeout_s + 10 # enlarge 10s

        return verify_timeout
    def __flash_verify_v2(self, address, img_content_size, orign_crc16):
        cmd_buf = []
        cmd_len = self.__generate_flash_verify_cmd_v2(CMDIDV4.CMD_FLASH_VERIFY_V2.value,
                                                   address,
                                                   img_content_size,
                                                   orign_crc16,
                                                   cmd_buf)
        verify_timeout_s = self.__calculate_verify_time_v2(img_content_size)
        LOG_DEBUG("verify timeout {} s for 0x{:08x}".format(verify_timeout_s,img_content_size))
        self._serialHdl.set_read_timeout(verify_timeout_s)
        written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: flash verify (address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                    address, img_content_size, cmd_len, written_len))
            self._serialHdl.reset_read_timeout()
            return ERR_DATA_UART_WRITE_FAIL


        check_rsp_ret = self.__check_flash_cmd_rsp_v2(CMDIDV4.CMD_FLASH_VERIFY_V2.value, address,
                                                      img_content_size)
        self._serialHdl.reset_read_timeout()
        if check_rsp_ret == ERR_OK:
            LOG_DEBUG("flash verify (address 0x%08X size 0x%x) ok" % (
                address, img_content_size))
            return ERR_OK
        else:
            LOG_DEBUG("flash verify (address 0x%08X size 0x%x) fail,return %d" % (
                address, img_content_size,check_rsp_ret))
            return check_rsp_ret


    def verify_v2(self, img_path, img_addr):
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

                verify_ret = self.__flash_verify_v2(img_addr, img_content_size,
                                                 crc16_orgfile)
                if verify_ret != ERR_OK:
                    LOG_ERR("Error: flash verify fail. address 0x%08X, size 0x%08X." % (
                        img_addr, img_content_size))
                    return verify_ret
                else:
                    return ERR_OK

        except:
            LOG_ERR("Error: fail to do flash verify for %s." % img_path)
            raise
    def __generate_sd_init_cmd(self, cmd_code, cmd_buf):

        cmd_fmt = "<BHIHBB"
        part1_fmt_size = struct.calcsize(cmd_fmt)
        payload_len = 4
        sd_bus_clk_sel = 0x0 # 5M
        sdh_bus_width = 2
        reserved= 0
        cmd_buf_part1 = struct.pack(cmd_fmt, MP_START_BYTE, cmd_code,payload_len,
                                    sd_bus_clk_sel,sdh_bus_width,reserved)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (part1_fmt_size + part2_fmt_size)
    def sd_init(self):
        cmd_buf = []
        cmd_code = CMDIDV4.CMD_SD_INIT.value
        cmd_len = self.__generate_sd_init_cmd(cmd_code, cmd_buf)

        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            return ERR_DATA_UART_WRITE_FAIL

        '''
          mp response cmd{
          B      MP_START_BYTE(0x87)
          H      CmdID
          B      status
          I      payload_size
          payload_size*B  payload (if payload_size is 0,it is without payload)
          H      crc16
          }
          efuse burn reponse payload len is 0 
        '''

        rsp_cmd_fmt = "<BHBIIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL("Fatal: wait for CMD_SD_INIT response,but rev cmd code 0x%x" % (
                    cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payloadlen,sd_status, = struct.unpack_from("<BII", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("SD init OK!")
                    #self.get_sd_capacity()
                    return ERR_OK
                else:
                    LOG_ERR("Error: SD init fail,mp status 0x%x  sd status 0x%x." % (status,sd_status))
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_DEBUG(list(rev_buf))
            LOG_ERR("Error: SD init rev timeout,need %d bytes,read %d bytes." % (
                rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def __generate_sd_erase_cmd(self, cmd_code, addr, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        part1_fmt = "<BHIQQ"
        part1_fmt_size = struct.calcsize(part1_fmt)

        cmd_buf_part1 = struct.pack(part1_fmt, MP_START_BYTE, cmd_code,16, addr, data_len)
        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (part1_fmt_size + part2_fmt_size)
    def __sd_erase_read_rsp(self,blk_addr, erase_size):
        '''
        mp response cmd{
        B      MP_START_BYTE(0x87)
        H      CmdID
        B      status
        I      payload_size
        payload_size*B  payload
        H      crc16
        }
        erase cmd without payload,payload_size is 0
        '''
        cmd_code = CMDIDV4.CMD_SD_SEC_ERASE
        rsp_cmd_fmt = "<BHBIIQQIIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for sd erase(address 0x%x size 0x%x) response,but rev rsp cmd code 0x%x" % (
                        blk_addr, erase_size, cmdIdRsp))
                return ERR_ERASE_FAIL
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_ERASE_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len,fix_payload_len,addr_rx,size_rx,sd_status,ext_payload_len, = struct.unpack_from("<BIIQQII",
                                                                                                                   rev_buf, STATUS_OFFSET)
                if status == 0:
                    if blk_addr == addr_rx and erase_size == size_rx:
                        LOG_DEBUG("SD erase (address 0x%x size 0x%x) ok" % (
                            blk_addr, erase_size))
                        return ERR_OK
                    else:
                        LOG_DEBUG("Error: SD erase (address 0x%x size 0x%x), but rx SD erase rsp (address 0x%x size 0x%x sd status %d)" % (
                            blk_addr, erase_size,addr_rx,size_rx,sd_status))
                        return ERR_ERASE_FAIL
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: erase SD(address 0x%x size 0x%x) fail,mp status 0x%x, sd status %d." % (
                            blk_addr, erase_size, status,sd_status))
                    return ERR_ERASE_FAIL
        else:
            LOG_ERR(
                "Error:erase SD(address 0x%x size 0x%x) receive timeout!need %d bytes,read %d bytes." % (
                    blk_addr, erase_size, rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_ERASE_FAIL

    def sd_erase(self, addr, size):
        if size == 0:
            LOG_CRITICAL("erase size is 0. Don't need to erase any space.")
            return ERR_OK

        cmd_code = CMDIDV4.CMD_SD_SEC_ERASE
        blk_size = 200*512 #0x400000# 0x10000  # 64KB
        blk_cnt = (size + blk_size -1)// blk_size
        PRINT_PERCENT = False
        if blk_cnt >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to erase address 0x%x size 0x%x" % (addr, size))

        blk_addr = addr
        erase_size = blk_size
        remain_size = size %blk_size
        self._serialHdl.set_read_timeout(5)

        is_clear_trx = True
        next_pkt_idx = 0
        if self.is_parallel_cmd:
            is_clear_trx = False
            cmd_buf = []
            if size <  blk_size:
                erase_size = size

            cmd_len = self.__generate_sd_erase_cmd(cmd_code,
                                                blk_addr,
                                                erase_size,
                                                cmd_buf)
            written_len = self._serialHdl.write(cmd_buf, cmd_len,is_clear_trx)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
                return ERR_ERASE_FAIL
            last_erase_addr = blk_addr
            last_erase_size = erase_size
            next_pkt_idx += 1
            time.sleep(0.1)

        for blk_idx in range(next_pkt_idx,blk_cnt):
            cmd_buf = []
            if (blk_idx == blk_cnt -1) and (remain_size > 0):
                erase_size = remain_size
            else:
                erase_size = blk_size

            if self.is_parallel_cmd:
                blk_addr += erase_size

            cmd_len = self.__generate_sd_erase_cmd(cmd_code,
                                                blk_addr,
                                                erase_size,
                                                cmd_buf)

            written_len = self._serialHdl.write(cmd_buf, cmd_len, is_clear_trx)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
                return ERR_ERASE_FAIL

            ret = self.__check_sd_cmd_rsp(cmd_code, last_erase_addr, last_erase_size)
            if ret != ERR_OK:
                return ret
            else:
                if self.is_parallel_cmd:
                    last_erase_addr = blk_addr
                    last_erase_size = erase_size
                else:
                    blk_addr += erase_size


            if PRINT_PERCENT:
                if (blk_idx + 1) % (int(blk_cnt * 0.1)) == 0:
                    percent = (blk_idx + 1) / blk_cnt
                    LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                        blk_idx + 1,
                        blk_cnt,
                        percent))
                    if blk_idx + 1 == blk_cnt:
                        PRINT_PERCENT = False

        ret = self.__check_sd_cmd_rsp(cmd_code,last_erase_addr, last_erase_size)
        if ret != ERR_OK:
            return ret

        time.sleep(0.1)

        if PRINT_PERCENT:
            if blk_idx + 1 == blk_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(blk_idx + 1,
                                                                     blk_cnt,
                                                                     (blk_idx + 1) / blk_cnt))
        self._serialHdl.reset_read_timeout()
        return ERR_OK

    def sd_erase_single(self,addr,size):
        if size == 0:
            LOG_CRITICAL("erase size is 0. Don't need to erase any space.")
            return ERR_OK

        cmd_code = CMDIDV4.CMD_SD_SEC_ERASE
        blk_size =  200*512 # 0x3e800 # 0x19000 # 0x400000 #0x10000  # 64KB
        blk_cnt = (size + blk_size - 1) // blk_size
        PRINT_PERCENT = False
        if blk_cnt >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to erase address 0x%x size 0x%x" % (addr, size))

        blk_addr = addr
        erase_size = blk_size
        remain_size = size % blk_size
        self._serialHdl.set_read_timeout(5)

        cmd_buf = []

        for blk_idx in range(0, blk_cnt):
            cmd_buf = []
            if (blk_idx == blk_cnt - 1) and (remain_size > 0):
                erase_size = remain_size
            else:
                erase_size = blk_size

            cmd_len = self.__generate_sd_erase_cmd(cmd_code,
                                                   blk_addr,
                                                   erase_size,
                                                   cmd_buf)

            written_len = self._serialHdl.write(cmd_buf, cmd_len)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        blk_addr, erase_size))
                return ERR_ERASE_FAIL

            ret = self.__sd_erase_read_rsp(blk_addr, erase_size)
            if ret != ERR_OK:
                return ret
            time.sleep(1)
            blk_addr += erase_size
            if PRINT_PERCENT:
                if (blk_idx + 1) % (int(blk_cnt * 0.1)) == 0:
                    percent = (blk_idx + 1) / blk_cnt
                    LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(
                        blk_idx + 1,
                        blk_cnt,
                        percent))
                    if blk_idx + 1 == blk_cnt:
                        PRINT_PERCENT = False

        if PRINT_PERCENT:
            if blk_idx + 1 == blk_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(blk_idx + 1,
                                                                  blk_cnt,
                                                                  (blk_idx + 1) / blk_cnt))

        self._serialHdl.reset_read_timeout()
        return ERR_OK
    def __check_sd_cmd_rsp(self,req_cmd_id, req_addr, req_size):
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size
            payload_size*B  payload
            (|fixed payload length(4B)|addr (4B) | size (4B) | ext payload length (4B)| ext payload )
            H      crc16
            }
            program reponse payload len is 0
         '''
        rsp_cmd_fmt = "<BHBIIQQIIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) > 8:
            rx_cmd_id,status,payload_len, = struct.unpack_from("<HBI", rev_buf, 1)
            if status != 0 and payload_len == 0:
                cmd_rsp_size = 10
            else:
                cmd_rsp_size = 38
        else:
            LOG_DEBUG(list(rev_buf))
            LOG_ERR("Error: read sd rsp data %d bytes less than 8 bytes for cmd 0x%02x" %(len(rev_buf),req_cmd_id))
            return ERR_DATA_UART_READ_FAIL

        if len(rev_buf) != cmd_rsp_size:
            LOG_ERR("Error: read sd rsp for cmd 0x%02x, need %d bytes but receive %d bytes" %(req_cmd_id, cmd_rsp_size,len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

        if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
            LOG_DEBUG(list(rev_buf))
            LOG_FATAL(
                "Fatal: check sd rsp for 0x%02x (address 0x%x size 0x%x) crc checking fail!" % (
                    req_cmd_id,req_addr, req_size))
            return ERR_CRC_CHK_FAIL

        if rx_cmd_id != req_cmd_id:
            LOG_CRITICAL(list(rev_buf))
            LOG_FATAL(
                "Fatal: check sd cmd rsp for cmd 0x%02x but receive rsp for cmd 0x%02x!" % (
                    req_cmd_id,rx_cmd_id))
            return ERR_REV_UNEXPECTED_RSP_CMD_CODE

        if status != 0:
            LOG_DEBUG(list(rev_buf))
            LOG_ERR(
                "Error: check sd cmd rsp (address 0x%08X size 0x%x) fail,status 0x%x." % (
                    req_addr, req_size, status))
            return ERR_STATUS_AUTH_FAIL
        else:
            STATUS_OFFSET = struct.calcsize("<BH")
            status,payload_len,fix_payload_len,addr_rx,size_rx,sd_status,ext_payload_len, = struct.unpack_from("<BIIQQII", rev_buf, STATUS_OFFSET)
            if req_addr == addr_rx and req_size == size_rx:
                LOG_DEBUG("check sd cmd rsp (address 0x%x size 0x%x) ok" % (
                    req_addr, req_size))
                return ERR_OK
            else:
                LOG_DEBUG("Error: check sd cmd rsp (address 0x%x size 0x%x), but rx rsp (address 0x%x size 0x%x status 0x%x  sd status %d)" % (
                    req_addr, req_size,addr_rx,size_rx, status,sd_status))
                return ERR_REV_UNEXPECTED_PARALLEL_RSP_INFO

    def __generate_sd_program(self, cmd_code, addr, data_buf, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BHIQQ%dB" % data_len
        cmd_buf_part1_fmt_size = struct.calcsize(cmd_buf_part1_fmt)

        if len(data_buf) != data_len:
            LOG_ERR("Error: generate program need %d bytes,but only %d bytes!" % (
                data_len, len(data_buf)))
            return 0

        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, 16+data_len,addr,
                                    data_len, *data_buf)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_fmt_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (cmd_buf_part1_fmt_size + cmd_buf_part2_fmt_size)
    def __sd_program_fp(self, address, data_len, fp):
        cmd_code = CMDIDV4.CMD_SD_PROGRAM.value
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        DATA_SIZE_PER_PACKET = 0x4000 #0x4000

        pkt_num = data_len // DATA_SIZE_PER_PACKET
        if data_len % DATA_SIZE_PER_PACKET != 0:
            pkt_num += 1

        dl_addr = address
        dl_size = DATA_SIZE_PER_PACKET

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to program address 0x%x size 0x%x" % (address, data_len))
        self._serialHdl.set_read_timeout(1)

        is_clear_trx = True
        if self.is_parallel_cmd:
            is_clear_trx = False
            # first packet
            if data_len < DATA_SIZE_PER_PACKET:
                dl_size = data_len
            cmd_buf = []
            cmd_len = self.__generate_sd_program(cmd_code,
                                              dl_addr,
                                              list(fp.read(dl_size)),
                                              dl_size,
                                              cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_sd_program fail.")
                return ERR_GENERATE_CMD_FAIL

            written_len = self.serial_write(cmd_buf, cmd_len,is_clear_trx)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        dl_addr, dl_size, cmd_len, written_len))
            else:
                LOG_DEBUG("program send request addr 0x%x  size 0x%x" % (dl_addr, dl_size))
            last_dl_addr = dl_addr
            last_dl_size = dl_size
            next_pkt_idx = 1
        else:
            next_pkt_idx = 0

        for pkt_idx in range(next_pkt_idx, pkt_num):
            cmd_buf = []
            if self.is_parallel_cmd:
                dl_addr += dl_size
            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET
            #t1=time.time()
            cmd_len = self.__generate_sd_program(cmd_code,
                                              dl_addr,
                                              list(fp.read(dl_size)),
                                              dl_size,
                                              cmd_buf)
            #t2=time.time()
            #LOG_CRITICAL(t2-t1)
            if cmd_len == 0:
                LOG_ERR("Error:generate_sd_program fail.")
                return ERR_GENERATE_CMD_FAIL

            written_len = self.serial_write(cmd_buf, cmd_len,is_clear_trx)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        dl_addr, dl_size, cmd_len, written_len))
                continue
            else:
                LOG_DEBUG("program send request addr 0x%x  size 0x%x, cmd len 0x%x" %(dl_addr, dl_size,cmd_len))
            if not self.is_parallel_cmd:
                last_dl_size = dl_size
                last_dl_addr = dl_addr
            check_rsp_ret = self.__check_sd_cmd_rsp(cmd_code,last_dl_addr, last_dl_size)
            if check_rsp_ret == ERR_OK:
                if self.is_parallel_cmd:
                    last_dl_addr = dl_addr
                    last_dl_size = dl_size
                else:
                    dl_addr += dl_size
                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG(
                            "\tprogram progress {}/{} {:.1%} ".format(
                                pkt_idx + 1,
                                pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
            else:
                self._serialHdl.reset_read_timeout()
                return check_rsp_ret
        if self.is_parallel_cmd:
            if self.__check_sd_cmd_rsp(cmd_code,last_dl_addr, last_dl_size) != ERR_OK:
                self._serialHdl.reset_read_timeout()
                return ERR_PROGRAM_RSP_FAIL

        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG(
                    "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
                                                              (pkt_idx + 1) / pkt_num))
        return ERR_OK

    def __sd_program_file(self, img_path, img_addr, img_content_size):
        file_size = os.path.getsize(img_path)
        LOG_DEBUG("file size: %d,  download content length: %d" % (file_size, img_content_size))

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

                program_ret = self.__sd_program_fp(img_addr, img_content_size, fp)
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

    def __sd_program_buf(self, data_buf, address, data_len):
        cmd_code =CMDIDV4.CMD_SD_PROGRAM.value
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        pkt_num = data_len // DATA_SIZE_PER_PACKET
        if data_len % DATA_SIZE_PER_PACKET != 0:
            pkt_num += 1

        dl_addr = address
        dl_size = DATA_SIZE_PER_PACKET

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to program address 0x%x size 0x%x" % (address, data_len))
        self._serialHdl.set_read_timeout(1)
        is_clear_trx = True
        if self.is_parallel_cmd:
            is_clear_trx = False
            # first packet
            if data_len < DATA_SIZE_PER_PACKET:
                dl_size = data_len
            cmd_buf = []
            cmd_len = self.__generate_sd_program(cmd_code,
                                              dl_addr,
                                              data_buf[0: dl_size],
                                              dl_size,
                                              cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_sd_program fail.")
                return ERR_GENERATE_CMD_FAIL

            written_len = self.serial_write(cmd_buf, cmd_len,is_clear_trx)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: SD program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        dl_addr, dl_size, cmd_len, written_len))
                return ERR_DATA_UART_WRITE_FAIL
            else:
                LOG_DEBUG("SD program send request addr 0x%x  size 0x%x" % (dl_addr, dl_size))

            last_dl_addr = dl_addr
            last_dl_size = dl_size
            next_pkt_idx = 1
        else:
            next_pkt_idx = 0

        for pkt_idx in range(next_pkt_idx,pkt_num):
            cmd_buf = []
            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET

            cmd_len = self.__generate_sd_program(cmd_code,
                                              dl_addr,
                                              data_buf[(pkt_idx * DATA_SIZE_PER_PACKET):(
                                                      pkt_idx * DATA_SIZE_PER_PACKET + dl_size)],
                                              dl_size,
                                              cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_program fail.")
                return ERR_GENERATE_CMD_FAIL

            written_len = self.serial_write(cmd_buf, cmd_len,is_clear_trx)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        dl_addr, dl_size, cmd_len, written_len))
                return ERR_DATA_UART_WRITE_FAIL
            else:
                LOG_DEBUG("program send request addr 0x%x  size 0x%x" %(dl_addr, dl_size))

            if not self.is_parallel_cmd:
                last_dl_addr = dl_addr
                last_dl_size = dl_size

            check_rsp_ret = self.__check_sd_cmd_rsp(cmd_code, last_dl_addr,
                                                              last_dl_size)

            if check_rsp_ret == ERR_OK:
                if self.is_parallel_cmd:
                    last_dl_addr = dl_addr
                    last_dl_size = dl_size
                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG(
                            "\tprogram progress {}/{} {:.1%} ".format(
                                pkt_idx + 1,
                                pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
            else:
                return check_rsp_ret
        if self.is_parallel_cmd:
            if self.__check_sd_cmd_rsp(cmd_code, last_dl_addr, last_dl_size) != ERR_OK:
                self._serialHdl.reset_read_timeout()
                return ERR_PROGRAM_RSP_FAIL

        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG(
                    "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
                                                              (pkt_idx + 1) / pkt_num))
        return ERR_OK
    def sd_program(self, dl_obj, dl_addr, dl_size):
        if dl_obj == None:
            return ERR_PROGRAM_OBJ_NONE

        if type(dl_obj) == str:
            return self.__sd_program_file(dl_obj, dl_addr, dl_size)
        elif type(dl_obj) == list:
            return self.__sd_program_buf(dl_obj, dl_addr, dl_size)
        else:
            raise Exception(
                "Error: don't support to program object type {}!".format(type(dl_obj)))
    def sd_program_single(self, dl_obj, dl_addr, dl_size):
        if dl_obj == None:
            return ERR_PROGRAM_OBJ_NONE
        if type(dl_obj) == str:
            return self.__sd_program_file(dl_obj, dl_addr, dl_size)
        elif type(dl_obj) == list:
            return self.__sd_program_buf(dl_obj, dl_addr, dl_size)
        else:
            raise Exception(
                "Error: don't support to program object type {}!".format(type(dl_obj)))
    def __generate_sd_verify_cmd(self, cmd_code, addr, data_len, orign_crc16,
                                    cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BHIQQH"
        cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code,18, addr,
                                    data_len,
                                    orign_crc16)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (cmd_buf_part1_size + cmd_buf_part2_size)
    def __sd_verify(self, address, img_content_size, orign_crc16):
        cmd_code = CMDIDV4.CMD_SD_VERIFY.value
        cmd_buf = []
        cmd_len = self.__generate_sd_verify_cmd(cmd_code,
                                                   address,
                                                   img_content_size,
                                                   orign_crc16,
                                                   cmd_buf)
        verify_timeout_s = self.__calculate_verify_time_v2(img_content_size)
        LOG_CRITICAL("verify timeout {} s for 0x{:8x}".format(verify_timeout_s,img_content_size))
        self._serialHdl.set_read_timeout(verify_timeout_s)
        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: SD verify (address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                    address, img_content_size, cmd_len, written_len))
            self._serialHdl.reset_read_timeout()
            return ERR_DATA_UART_WRITE_FAIL

        check_rsp_ret = self.__check_sd_cmd_rsp(cmd_code, address,
                                                      img_content_size)
        self._serialHdl.reset_read_timeout()
        if check_rsp_ret == ERR_OK:
            LOG_DEBUG("SD verify (address 0x%08X size 0x%x) ok" % (
                address, img_content_size))
            return ERR_OK
        else:
            LOG_DEBUG("SD verify (address 0x%08X size 0x%x) fail,return %d" % (
                address, img_content_size,check_rsp_ret))
            return check_rsp_ret


    def sd_verify(self, img_path, img_addr):
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

                verify_ret = self.__sd_verify(img_addr, img_content_size,
                                                 crc16_orgfile)
                if verify_ret != ERR_OK:
                    LOG_ERR("Error: sd verify fail. address 0x%08X, size 0x%08X." % (
                        img_addr, img_content_size))
                    return verify_ret
                else:
                    return ERR_OK

        except:
            LOG_ERR("Error: fail to do sd verify for %s." % img_path)
            raise
    def __generate_sd_read_cmd(self, cmd_code, addr, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        part1_fmt = "<BHIQQ"
        part1_fmt_size = struct.calcsize(part1_fmt)

        cmd_buf_part1 = struct.pack(part1_fmt, MP_START_BYTE, cmd_code,16, addr, data_len)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (part1_fmt_size + part2_fmt_size)
    def __sd_read_as_file(self, addr, rd_size, save_file):
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
            if self.__sd_read_into_buf(rd_addr, pkt_size, read_buf) == 0:
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

    def __sd_read_into_buf(self, addr, data_len, read_buf=None, is_handshake=False):
        cmd_code = CMDIDV4.CMD_SD_READ.value
        PRINT_PERCENT = False
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        pkt_cnt = 1 if is_handshake else (data_len + DATA_SIZE_PER_PACKET - 1) // DATA_SIZE_PER_PACKET

        if read_buf == None:
            read_buf = []

        if is_handshake == False:
            self._serialHdl.set_read_timeout(3)
            if data_len > DATA_SIZE_PER_PACKET:
                if data_len >= 0x40000:
                    LOG_CRITICAL("please wait for reading flash data ......")

                if pkt_cnt >= 50:
                    PRINT_PERCENT = True
                    LOG_DEBUG("start to read address 0x%x size 0x%x" % (addr, data_len))
        else:
            self._serialHdl.set_read_timeout(0.5)

        for pkt_idx in range(pkt_cnt):
            cmd_buf = []

            bytes_remain = data_len - (pkt_idx * DATA_SIZE_PER_PACKET)
            to_read_len = min(DATA_SIZE_PER_PACKET, bytes_remain)

            to_read_address = addr + pkt_idx * DATA_SIZE_PER_PACKET
            cmd_len = self.__generate_sd_read_cmd(cmd_code,
                                                     to_read_address,
                                                     to_read_len,
                                                     cmd_buf)
            total_retry_times = self._config.CONFIG_READ_RETRY_MAX_TIMES
            '''
               if the procedure is to read only 1 byte, it may be 
               detecting connection procedure, and it will not retry!
            '''
            if to_read_len <= 1:
                total_retry_times = 1

            try_times = total_retry_times
            is_retry = True

            while (is_retry and try_times > 0):
                try_times = try_times - 1
                if try_times != total_retry_times - 1:
                    LOG_CRITICAL("retry to read %d for address 0x%x size 0x%x" % (
                        total_retry_times - try_times, to_read_address, to_read_len))
                    # delay 1 second in the retry mechanism between two request
                    time.sleep(1)

                written_len = self._serialHdl.write(cmd_buf, cmd_len)
                if written_len != cmd_len:
                    LOG_ERR(
                        "Error: flash read(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" %
                        (to_read_address, to_read_len, cmd_len, written_len))
                    continue

                '''
                     mp response cmd{
                     B      MP_START_BYTE(0x87)
                     H      CmdID
                     B      status
                     I      payload_size
                     payload_size*B  payload
                     H      crc16
                     }
                     flash read reponse payload len is the length requesting to read
                  '''
                pre_payload_len = struct.calcsize("<BHBIIQQII")
                rsp_cmd_fmt = "<BHBIIQQII%dBH" % to_read_len
                rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)

                rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

                if len(rev_buf) == rsp_cmd_fmt_size or len(rev_buf) == 10:
                    cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
                    expected_rsp_id = cmd_code
                    if cmdIdRsp != expected_rsp_id:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: wait for read response(address 0x%x size 0x%x),but rev the rsp cmd code 0x%x" %
                            (to_read_address, to_read_len, cmdIdRsp))
                        continue
                    if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                        LOG_FATAL(
                            "Fatal:read response(address 0x%x size 0x%x) crc checking fail" % (
                                to_read_address, to_read_len))
                        LOG_DEBUG(list(rev_buf))
                        continue
                    else:
                        STATUS_OFFSET = struct.calcsize("<BH")
                        status,payload_len,fix_payload_len,addr_rx,size_rx,sd_status,ext_payload_len, = struct.unpack_from("<BIIQQII", rev_buf, STATUS_OFFSET)
                        if status == 0:
                            read_buf += rev_buf[
                                        pre_payload_len:pre_payload_len + ext_payload_len]
                            is_retry = False
                            if PRINT_PERCENT:
                                if (pkt_idx + 1) % (int(pkt_cnt * 0.1)) == 0:
                                    percent = (pkt_idx + 1) / pkt_cnt
                                    LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                                        pkt_idx + 1, pkt_cnt, percent))
                                    if pkt_idx + 1 == pkt_cnt:
                                        PRINT_PERCENT = False
                        else:
                            if is_handshake:
                                # just check crc and rsp command id for handshake
                                self._serialHdl.reset_read_timeout()
                                return ERR_OK
                            else:
                                LOG_ERR(
                                    "Error: sd read (address 0x%08X size 0x%x) fail,status 0x%x." % \
                                    (to_read_address, to_read_len, status))
                                if status == 0x36: #MP_STATUS_ADDR_RANGE_CHK_FAIL
                                    LOG_ERR("sd read space is out of flash range!")
                                    break
                                else:
                                    continue

                else:

                    LOG_ERR(
                        "Error:sd read(address 0x%08X size 0x%x) rev timeout!need %d bytes,read %d bytes." % \
                        (to_read_address, to_read_len, rsp_cmd_fmt_size, len(rev_buf)))

                    continue
            if total_retry_times != 1:
                add_read_retry_times(self._config.CONFIG_READ_RETRY_MAX_TIMES - try_times - 1)

            if is_retry == True:
                self._serialHdl.reset_read_timeout()
                return ERR_FLASH_READ_FAIL
            else:
                continue

        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_cnt:
                LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                    pkt_idx + 1, pkt_cnt, (pkt_idx + 1) / pkt_cnt))
        return ERR_OK
    def sd_read(self, addr, rd_size, saveObj):
        if type(saveObj) == list:
            return self.__sd_read_into_buf(addr, rd_size, saveObj)
        if type(saveObj) == str:
            return self.__sd_read_as_file(addr, rd_size, saveObj)
        else:
            raise Exception("Error: Don't support saveobj type {}".format(type(saveObj)))
    def get_sd_capacity(self):
        cmd_code = CMDIDV4.CMD_SD_GET_CAPACITY.value
        cmd_buf = []
        cmd_buf_part1_fmt = "<BHI"
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE,cmd_code,0)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send get sd capacity command!")
            return ERR_DATA_UART_WRITE_FAIL

        rsp_cmd_fmt = "<BHBIQH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for get sd capacity response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len,sd_capacity, = struct.unpack_from("<BIQ", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_DEBUG(list(rev_buf))
                    LOG_CRITICAL("get sd capacity {} ok".format(sd_capacity))
                    self.sd_capacity = sd_capacity

                    return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: get sd capacity fail,status %d." % (status))
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR(
                "Error:get sd capacity receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def get_sd_base_addr(self):
        cmd_code = CMDIDV4.CMD_SD_GET_BASE_ADDR.value
        cmd_buf = []
        cmd_buf_part1_fmt = "<BHI"
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE,cmd_code,0)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send get sd base address command!")
            return ERR_DATA_UART_WRITE_FAIL

        rsp_cmd_fmt = "<BHBIQH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for get sd base address response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len,sd_base_addr, = struct.unpack_from("<BIQ", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("get sd base address {} ok".format(hex(sd_base_addr)))
                    self.sd_base_addr = sd_base_addr

                    return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: get sd base address fail,status %d." % (status))
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR(
                "Error:get sd base address receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def set_sd_base_addr(self, sd_base_addr):
        cmd_code = CMDIDV4.CMD_SD_SET_BASE_ADDR.value
        cmd_buf = []
        cmd_buf_part1_fmt = "<BHIQ"
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE,cmd_code,8,sd_base_addr)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send set sd base address command!")
            return ERR_DATA_UART_WRITE_FAIL

        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for set sd base address response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,payload_len, = struct.unpack_from("<BI", rev_buf, STATUS_OFFSET)
                if status == 0:
                    self.sd_base_addr = sd_base_addr
                    LOG_CRITICAL("set sd base address {} ok".format(hex(sd_base_addr)))

                    return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: set sd base address fail,status %d." % (status))
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR(
                "Error:set sd base address receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def __generate_enter_ft_mode_cmd(self, cmd_code, cmd_buf):

        cmd_fmt = "<BH"
        part1_fmt_size = struct.calcsize(cmd_fmt)
        cmd_buf_part1 = struct.pack(cmd_fmt, MP_START_BYTE, cmd_code)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (part1_fmt_size + part2_fmt_size)
    def enter_ft_mode(self):
        cmd_code = CMDIDV4.CMD_ENTER_FT_MODE.value
        cmd_buf = []
        cmd_len = self.__generate_enter_ft_mode_cmd(cmd_code, cmd_buf)
        LOG_CRITICAL(
            "enter ft mode request:{}".format(",".join([hex(n)[2:].upper() for n in list(cmd_buf)])))

        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            return ERR_DATA_UART_WRITE_FAIL

        '''
          mp response cmd{
          B      MP_START_BYTE(0x87)
          H      CmdID
          B      status
          I      payload_size
          payload_size*B  payload (if payload_size is 0,it is without payload)
          H      crc16
          }
          efuse burn reponse payload len is 0 
        '''

        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = cmd_code
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL("Fatal: wait for CMD_ENTER_FT_MODE 0x1043  response,but rev cmd code 0x%x" % (
                    cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("Enter FT mode OK!")
                    LOG_CRITICAL(
                        "enter ft mode request:{}".format(",".join([hex(n)[2:].upper() for n in list(cmd_buf)])))

                    return ERR_OK
                else:
                    LOG_ERR("Error:Enter FT mode  fail,status 0x%x." % status)
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR("Error: Enter FT mode  rev timeout,need %d bytes,read %d bytes." % (
                rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

    def __send_program_req(self, address, data_len, fp):
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        pkt_num = data_len // DATA_SIZE_PER_PACKET
        if data_len % DATA_SIZE_PER_PACKET != 0:
            pkt_num += 1

        dl_addr = address
        dl_size = DATA_SIZE_PER_PACKET

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True
            LOG_DEBUG("start to program address 0x%x size 0x%x" % (address, data_len))

        for pkt_idx in range(0, pkt_num):
            if self._stop_program:
                break
            cmd_buf = []

            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET

            cmd_len = self.__generate_program_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value,
                                                 dl_addr,
                                                 list(fp.read(dl_size)),
                                                 dl_size,
                                                 cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_program fail.")
                return ERR_GENERATE_CMD_FAIL

            if pkt_idx > 1:
                while not self._sync_event.isSet():
                    self._sync_event.wait(0.005)
                self._sync_event.clear()

            written_len = self.serial_write(cmd_buf, cmd_len, False)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        dl_addr, dl_size, cmd_len, written_len))
                continue
            else:
                LOG_DEBUG("program send request addr 0x%x  size 0x%x" % (dl_addr, dl_size))
                dl_addr += dl_size
        LOG_CRITICAL("exit __send_program_req thread")
        return 0
    def __check_program_rsp(self, address, data_len,fp):
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        pkt_num = data_len // DATA_SIZE_PER_PACKET
        if data_len % DATA_SIZE_PER_PACKET != 0:
            pkt_num += 1

        PRINT_PERCENT = False
        if pkt_num >= 50:
            PRINT_PERCENT = True

        last_dl_addr = address

        for pkt_idx in range(0, pkt_num):
            if self._stop_program:
                break
            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET
            last_dl_size = dl_size

            while self._serialHdl.in_waiting == 0:
                time.sleep(0.005)
            check_rsp_ret = self.__check_flash_cmd_rsp_v2(CMDIDV4.CMD_FLASH_PROGRAM_V2.value, last_dl_addr, last_dl_size)
            if check_rsp_ret == ERR_OK:
                last_dl_addr += dl_size
                if self._sync_event.isSet() == False:
                    self._sync_event.set()
                if PRINT_PERCENT:
                    if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
                        percent = (pkt_idx + 1) / pkt_num
                        LOG_DEBUG(
                            "\tprogram progress {}/{} {:.1%} ".format(
                                pkt_idx + 1,
                                pkt_num, percent))
                        if pkt_idx + 1 == pkt_num:
                            PRINT_PERCENT = False
            else:
                self._program_rst = check_rsp_ret
                return check_rsp_ret

        self._program_rst = ERR_OK
        return 0
    def _stop_program_thread(self,signal, frame,):
        LOG_CRITICAL('You pressed Ctrl+C')
        self._stop_program = True
    def __mp_program_paralell(self, address, data_len, fp):
        read_timeout_s = 2000
        total_wait_s = 200
        threads = []
        self._program_rst = ERR_DOWNLOAD_IMG_FAIL
        self._stop_program = False

        self._serialHdl.set_read_timeout(read_timeout_s / 1000)

        self.__reset()
        self._sync_event = threading.Event()
        SIGINT_hdl = signal.getsignal(signal.SIGINT)
        SIGTERM_hdl = signal.getsignal(signal.SIGTERM)
        signal.signal(signal.SIGINT,self._stop_program_thread)
        signal.signal(signal.SIGTERM, self._stop_program_thread)

       #program_timer = threading.Timer(total_wait_s, self._program_timer)

        thread_args = ( address, data_len, fp)
        self._send_program_thread_hdl = threading.Thread(
            target=self.__send_program_req,args=thread_args,
           daemon=True)
        threads.append(self._send_program_thread_hdl)

        self._check_program_rsp_thread_hdl = threading.Thread(
            target=self.__check_program_rsp,args=thread_args,
            daemon=True)
        threads.append(self._check_program_rsp_thread_hdl)

        #program_timer.start()

        self._check_program_rsp_thread_hdl.start()
        self._send_program_thread_hdl.start()

        self._thread_join(threads)

        self._sync_event.clear()
        #program_timer.cancel()

        self._serialHdl.reset_read_timeout()

        # clear UART tx/rx buffer
        time.sleep(0.2)
        self._serialHdl.clear_trx_buf()
        signal.signal(signal.SIGINT, SIGINT_hdl)
        signal.signal(signal.SIGTERM, SIGTERM_hdl)

        return self._program_rst
    def __flash_read_as_file_v2(self, addr, rd_size, save_file):
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
            if self.__flash_read_into_buf_v2(rd_addr, pkt_size, read_buf) == 0:
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
    def __generate_flash_read_cmd(self, cmd_code, addr, data_len,
                                  cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []
        if cmd_code == CMDIDV4.CMD_FLASH_READ_V2.value:
            cmd_buf_part1_fmt = "<BHIII"
            cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
            cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code,8, addr,
                                        data_len)

        else:
            cmd_buf_part1_fmt = "<BHII"
            cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
            cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, addr,
                                    data_len)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        return (cmd_buf_part1_size + cmd_buf_part2_size)
    def __flash_read_into_buf_v2(self, addr, data_len, read_buf=None, is_handshake=False):
        cmd_code = CMDIDV4.CMD_FLASH_READ_V2.value

        PRINT_PERCENT = False
        DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k

        pkt_cnt = 1 if is_handshake else (data_len + DATA_SIZE_PER_PACKET - 1) // DATA_SIZE_PER_PACKET

        if read_buf == None:
            read_buf = []

        if is_handshake == False:
            self._serialHdl.set_read_timeout(3)
            if data_len > DATA_SIZE_PER_PACKET:
                if data_len >= 0x40000:
                    LOG_CRITICAL("please wait for reading flash data ......")

                if pkt_cnt >= 50:
                    PRINT_PERCENT = True
                    LOG_DEBUG("start to read address 0x%x size 0x%x" % (addr, data_len))
        else:
            self._serialHdl.set_read_timeout(0.5)

        for pkt_idx in range(pkt_cnt):
            cmd_buf = []

            bytes_remain = data_len - (pkt_idx * DATA_SIZE_PER_PACKET)
            to_read_len = min(DATA_SIZE_PER_PACKET, bytes_remain)

            to_read_address = addr + pkt_idx * DATA_SIZE_PER_PACKET
            cmd_len = self.__generate_flash_read_cmd(cmd_code,
                                                     to_read_address,
                                                     to_read_len,
                                                     cmd_buf)
            total_retry_times = self._config.CONFIG_READ_RETRY_MAX_TIMES
            '''
               if the procedure is to read only 1 byte, it may be 
               detecting connection procedure, and it will not retry!
            '''
            if to_read_len <= 1:
                total_retry_times = 1

            try_times = total_retry_times
            is_retry = True

            while (is_retry and try_times > 0):
                try_times = try_times - 1
                if try_times != total_retry_times - 1:
                    LOG_CRITICAL("retry to read %d for address 0x%x size 0x%x" % (
                        total_retry_times - try_times, to_read_address, to_read_len))
                    # delay 1 second in the retry mechanism between two request
                    time.sleep(1)

                written_len = self._serialHdl.write(cmd_buf, cmd_len)
                if written_len != cmd_len:
                    LOG_ERR(
                        "Error: flash read(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" %
                        (to_read_address, to_read_len, cmd_len, written_len))
                    continue

                '''
                     mp response cmd{
                     B      MP_START_BYTE(0x87)
                     H      CmdID
                     B      status
                     I      payload_size
                     payload_size*B  payload
                     H      crc16
                     }
                     flash read reponse payload len is the length requesting to read
                  '''

                pre_payload_len = struct.calcsize("<BHBI5I")
                rsp_cmd_fmt = "<BHBI5I%dBH" % to_read_len
                rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)

                rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

                if len(rev_buf) == rsp_cmd_fmt_size or len(rev_buf) == 10:
                    cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
                    expected_rsp_id = cmd_code
                    if cmdIdRsp != expected_rsp_id:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: wait for read response(address 0x%x size 0x%x),but rev the rsp cmd code 0x%x" %
                            (to_read_address, to_read_len, cmdIdRsp))
                        continue
                    if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                        LOG_FATAL(
                            "Fatal:read response(address 0x%x size 0x%x) crc checking fail" % (
                                to_read_address, to_read_len))
                        LOG_DEBUG(list(rev_buf))
                        continue
                    else:
                        STATUS_OFFSET = struct.calcsize("<BH")
                        status,payload_length,fixed_field_length,read_addr,read_len, flash_status,ext_filed_len, = struct.unpack_from("<B6I", rev_buf, STATUS_OFFSET)
                        if status == 0:
                            read_buf += rev_buf[
                                        pre_payload_len:pre_payload_len + to_read_len]
                            is_retry = False
                            if PRINT_PERCENT:
                                if (pkt_idx + 1) % (int(pkt_cnt * 0.1)) == 0:
                                    percent = (pkt_idx + 1) / pkt_cnt
                                    LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                                        pkt_idx + 1, pkt_cnt, percent))
                                    if pkt_idx + 1 == pkt_cnt:
                                        PRINT_PERCENT = False
                        else:
                            if is_handshake:
                                # just check crc and rsp command id for handshake
                                self._serialHdl.reset_read_timeout()
                                return ERR_OK
                            else:
                                LOG_ERR(
                                    "Error: flash read (address 0x%08X size 0x%x) fail,status 0x%x." % \
                                    (to_read_address, to_read_len, status))
                                if status == 0x36: #MP_STATUS_ADDR_RANGE_CHK_FAIL
                                    LOG_ERR("flash read space is out of flash range!")
                                    break
                                else:
                                    continue

                else:

                    LOG_ERR(
                        "Error:flash read(address 0x%08X size 0x%x) rev timeout!need %d bytes,read %d bytes." % \
                        (to_read_address, to_read_len, rsp_cmd_fmt_size, len(rev_buf)))

                    continue
            if total_retry_times != 1:
                add_read_retry_times(self._config.CONFIG_READ_RETRY_MAX_TIMES - try_times - 1)

            if is_retry == True:
                self._serialHdl.reset_read_timeout()
                return ERR_FLASH_READ_FAIL
            else:
                continue

        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_cnt:
                LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
                    pkt_idx + 1, pkt_cnt, (pkt_idx + 1) / pkt_cnt))
        return ERR_OK

    def flash_read(self, addr, rd_size, saveObj):
        if type(saveObj) == list:
            return self.__flash_read_into_buf_v2(addr, rd_size, saveObj)
        if type(saveObj) == str:
            return self.__flash_read_as_file_v2(addr, rd_size, saveObj)
        else:
            raise Exception("Error: Don't support saveobj type {}".format(type(saveObj)))

    def read_mem(self, mem_addr, mem_size, save_file=None):
        BLK_SIZE = 4096
        blk_cnt = mem_size // BLK_SIZE
        remain_size = mem_size % BLK_SIZE
        if remain_size != 0:
            blk_cnt += 1

        read_buf = []

        save_fp = None
        if save_file != None:
            save_fp = open(save_file, "wb")

        read_addr = mem_addr
        for index in range(blk_cnt):
            if index == blk_cnt - 1:
                read_size = remain_size if remain_size > 0 else BLK_SIZE
            else:
                read_size =  BLK_SIZE
            read_ret = self._read_mem(read_addr, read_size)
            if type(read_ret) != bytes:
                LOG_ERR("Error: read mem 0x{:08x}  size 0x{:x} fail ret {}".format(read_addr, read_size, read_ret))
                return read_ret
            else:
                read_buf.extend(list(read_ret))
                if save_fp:
                    save_fp.write(read_ret)
                    save_fp.flush()
                read_addr += read_size
        if save_fp:
            LOG_CRITICAL("read mem done: addr 0x{:08x} size 0x{:08x}  file {} ".format(mem_addr, mem_size, save_file))
            save_fp.close()

        return read_buf

    def serial_write(self, dataBuf, dataSize,clear_trx = True):
        if (self.get_wire_mode() == USB_DEV_MODE) and (dataSize %64 == 0):
            self._serialHdl.write(dataBuf[:-4], dataSize-4, clear_trx)
            self._serialHdl.write(dataBuf[-4:], 4, clear_trx)
            return dataSize
        else:
            return self._serialHdl.write(dataBuf,dataSize,clear_trx)
    def get_rom_ver(self):
        if self._rom_ver == None:
            return None
        return (self._rom_ver&0xFF)
    def cmd_get_propety(self):
        cmd_buf = []
        cmd_buf_part1_fmt = "<BH"
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, CmdID.CMD_GET_PROPERTY.value)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)


        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send get propety command!")
            return ERR_DATA_UART_WRITE_FAIL

        rsp_cmd_fmt = "<BHBI4IH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CmdID.CMD_GET_PROPERTY.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for get propety response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status,rsp_len,ram_base,ram_size,rom_ver,version, = struct.unpack_from("<BI4I", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("get propety ok,ic rom ver {}".format(rom_ver&0xFF))
                    LOG_DEBUG("property info:{}".format(
                        ",".join([hex(n)[2:].upper() for n in list(rev_buf)])))
                    self._rom_ver = rom_ver

                    return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: get propety fail,status %d." % ( status))
                    return ERR_DATA_UART_STATUS_FAIL

        else:
            LOG_ERR(
                "Error:get propety receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL