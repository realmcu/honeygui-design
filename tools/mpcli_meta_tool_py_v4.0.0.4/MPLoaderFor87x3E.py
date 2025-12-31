from MPLoaderFor8763CV2 import *
from MPLoader_cmd_def import *
from flash_ioctl_code_def import *
from crc import CRC
from mp_utility import *
from mp_setting import *

class MPLoaderFor87x3E(MPLoaderFor8763CV2):
    def __init__(self, config, serialHdl):
        super(MPLoaderFor8763CV2, self).__init__(config, serialHdl)

        self._config = config
        self._serialHdl = serialHdl

        self._handshake_type = HANDSHAKE_TYPE.RUN_MP_LOADER
        self._cache_handshake_data = []
        self._stop_handshake = False
        self._sync_event = None
        self._wire_mode = TWO_WIRE_MODE

    # def __generate_read_efuse_data(self,cmd_code,addr,size,cmd_buf=None):
    #     if cmd_buf == None:
    #         cmd_buf = []
    #     '''
    #     B  start byte
    #     H  cmd code
    #     B  bank   fixed 0
    #     H  addr
    #     H  size
    #     H  crc
    #     '''
    #     cmd_buf_part1_fmt = "<BHBHH"
    #     bank = 0
    #     cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
    #     cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt,
    #                                 MP_START_BYTE,
    #                                 cmd_code,
    #                                 bank,
    #                                 addr,
    #                                 size)
    #
    #     crc_init = 0
    #     crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
    #     cmd_buf_part2_fmt = "<H"
    #     cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
    #     cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)
    #
    #     cmd_buf += list(cmd_buf_part1)
    #     cmd_buf += list(cmd_buf_part2)
    #
    #     return (cmd_buf_part1_size + cmd_buf_part2_size)
    #
    # def read_efuse_data_on_ram(self, addr, size):
    #     return self.read_efuse_data(CmdID.CMD_READ_EFUSE_ON_RAM.value, addr, size)
    #
    # def read_efuse_data_on_phy(self, addr, size):
    #     return self.read_efuse_data(CmdID.CMD_READ_EFUSE_DATA.value, addr, size)

    # def read_efuse_data(self, cmdid, addr, size):
    #
    #     read_efuse_buf = []
    #     DATA_SIZE_PER_PACKET = 1024  # for gdma method 16K, if polling, set it to 32k
    #     data_len = size
    #     pkt_cnt =  (data_len + DATA_SIZE_PER_PACKET - 1) // DATA_SIZE_PER_PACKET
    #
    #     for pkt_idx in range(pkt_cnt):
    #         cmd_buf = []
    #
    #         bytes_remain = data_len - (pkt_idx * DATA_SIZE_PER_PACKET)
    #         to_read_len = min(DATA_SIZE_PER_PACKET, bytes_remain)
    #
    #         to_read_address = addr + pkt_idx * DATA_SIZE_PER_PACKET
    #
    #         cmd_len = self.__generate_read_efuse_data(cmdid, to_read_address, to_read_len, cmd_buf)
    #
    #         written_len = self._serialHdl.write(cmd_buf, cmd_len)
    #         if written_len != cmd_len:
    #             LOG_ERR(
    #                 "Error: read efuse data to send %d bytes,but written_len is %d!" %
    #                 (cmd_len, written_len))
    #             return ERR_DATA_UART_WRITE_FAIL
    #         '''
    #             mp response cmd{
    #             B      MP_START_BYTE(0x87)
    #             H      CmdID
    #             B      status
    #             I      payload_size (4 Bytes)
    #             H      read_back_len
    #             read_back_len*B  read back data
    #             H      crc16
    #             }
    #             read efuse reponse payload len is 4 Bytes
    #         '''
    #
    #         pre_payload_len = struct.calcsize("<BHBI")
    #
    #         rsp_cmd_fmt = "<BHBI%dBH" % (to_read_len + 2)
    #         rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
    #         zero_rsp_cmd_size = struct.calcsize("<BHBIHH")
    #         authen_fail_rsp_size = struct.calcsize("<BHBIH")
    #         self._serialHdl.set_read_timeout(1)
    #
    #         rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
    #         self._serialHdl.reset_read_timeout()
    #
    #         if len(rev_buf) == rsp_cmd_fmt_size or \
    #                 len(rev_buf) == zero_rsp_cmd_size or \
    #                 len(rev_buf) == authen_fail_rsp_size:
    #             start_flag, cmdIdRsp, = struct.unpack_from("<BH", rev_buf, 0)
    #             if start_flag != MP_START_BYTE:
    #                 LOG_FATAL("Error: read efuse fail for the invalid start flag 0x%x" % start_flag)
    #                 return ERR_REV_INVALID_START_FLAG
    #
    #             expected_rsp_id = cmdid
    #             if cmdIdRsp != expected_rsp_id:
    #                 LOG_DEBUG(list(rev_buf))
    #                 LOG_FATAL(
    #                     "Fatal: wait for read efuse response,but rev the rsp cmd code 0x%x" % cmdIdRsp)
    #                 return ERR_REV_UNEXPECTED_RSP_CMD_CODE
    #
    #             if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
    #                 LOG_FATAL("Fatal:read efuse response crc checking fail")
    #                 LOG_DEBUG(list(rev_buf))
    #                 return ERR_CRC_CHK_FAIL
    #             else:
    #                 STATUS_OFFSET = struct.calcsize("<BH")
    #                 status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
    #                 if status == 0:
    #                     read_back_len, = struct.unpack_from("<H", rev_buf, pre_payload_len)
    #                     read_back_data = rev_buf[pre_payload_len + 2:pre_payload_len + 2 + read_back_len]
    #
    #                     read_efuse_buf += read_back_data
    #
    #                     LOG_CRITICAL("read efuse addr 0x%x size 0x%x:" % (to_read_address, to_read_len))
    #                     LOG_CRITICAL("{}".format(bytes(read_back_data).hex()))
    #                     continue
    #                     #return read_back_data
    #                 else:
    #                     LOG_ERR("Error: read efuse status 0x%x" % status)
    #                     return ERR_DATA_UART_STATUS_FAIL
    #         else:
    #             LOG_ERR("Error: to read efuse rsp 0x%x bytes but read 0x%x bytes" % (rsp_cmd_fmt_size, len(rev_buf)))
    #             return ERR_DATA_UART_READ_FAIL
    #     return read_efuse_buf
    #
    # def __generate_write_efuse_data(self, cmd_code, addr,  data_buf, cmd_buf=None):
    #     if cmd_buf == None:
    #         cmd_buf = []
    #
    #     '''
    #     B  start byte
    #     H  cmd code
    #     B  bank   fixed 0
    #     H  addr
    #     H  size
    #     B*size data
    #     H  crc
    #     '''
    #     size = len(data_buf)
    #     cmd_buf_part1_fmt = "<BHBHH%dB" % size
    #     bank = 0
    #     cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
    #     cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt,
    #                                 MP_START_BYTE,
    #                                 cmd_code,
    #                                 bank,
    #                                 addr,
    #                                 size,
    #                                 *data_buf)
    #
    #     crc_init = 0
    #     crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
    #     cmd_buf_part2_fmt = "<H"
    #     cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
    #     cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)
    #
    #     cmd_buf += list(cmd_buf_part1)
    #     cmd_buf += list(cmd_buf_part2)
    #
    #     return (cmd_buf_part1_size + cmd_buf_part2_size)

    # def write_efuse_data(self, addr, data_buf):
    #     cmd_buf = []
    #     if type(data_buf) == str:
    #         bytes_data = bytes.fromhex(data_buf)
    #         data_buf = [d for d in bytes_data]
    #
    #     # data_buf = [0xFF] * 512
    #     #
    #     # fp = open(r"F:\BB2_code\BB2_bCut\BB2_V0.2.0.4_1.7.7.0_2M\efuse_bb2_seucre_boot.bin",'rb+')
    #     # data_buf = fp.read()read
    #
    #
    #     #LOG_CRITICAL(len(data_buf))
    #     #LOG_CRITICAL([hex(i) for i in data_buf])
    #     #return ERR_OK
    #
    #     size = len(data_buf)
    #     cmd_len = self.__generate_write_efuse_data(CmdID.CMD_WRITE_EFUSE_DATA.value, addr, data_buf, cmd_buf)
    #
    #     written_len = self._serialHdl.write(cmd_buf, cmd_len)
    #     if written_len != cmd_len:
    #         LOG_ERR(
    #             "Error: write efuse data to send %d bytes,but written_len is %d!" %
    #             (cmd_len, written_len))
    #         return ERR_DATA_UART_WRITE_FAIL
    #     '''
    #         mp response cmd{
    #         B      MP_START_BYTE(0x87)
    #         H      CmdID
    #         B      status
    #         I      payload_size (4 Bytes)
    #         H      read_bank_len
    #         H      crc16
    #         }
    #         write efuse reponse payload len is 4 Bytes
    #     '''
    #     pre_payload_len = struct.calcsize("<BHBI")
    #     rsp_cmd_fmt = "<BHBIHH"
    #     rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
    #     authen_fail_rsp_size = struct.calcsize("<BHBIH")
    #
    #     self._serialHdl.set_read_timeout(1)
    #     rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
    #     self._serialHdl.reset_read_timeout()
    #
    #     if len(rev_buf) == rsp_cmd_fmt_size or \
    #             len(rev_buf) == authen_fail_rsp_size:
    #         start_flag, cmdIdRsp, = struct.unpack_from("<BH", rev_buf, 0)
    #         if start_flag != MP_START_BYTE:
    #             LOG_FATAL("Error: write efuse fail for the invalid start flag 0x%x" % start_flag)
    #             return ERR_REV_INVALID_START_FLAG
    #
    #         expected_rsp_id = CmdID.CMD_WRITE_EFUSE_DATA.value
    #         if cmdIdRsp != expected_rsp_id:
    #             LOG_DEBUG(list(rev_buf))
    #             LOG_FATAL(
    #                 "Fatal: wait for write efuse response,but rev the rsp cmd code 0x%x" % cmdIdRsp)
    #             return ERR_REV_UNEXPECTED_RSP_CMD_CODE
    #
    #         if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
    #             LOG_FATAL("Fatal:write efuse response crc checking fail")
    #             LOG_DEBUG(list(rev_buf))
    #             return ERR_CRC_CHK_FAIL
    #         else:
    #             STATUS_OFFSET = struct.calcsize("<BH")
    #             status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
    #             if status == 0:
    #                 write_efuse_len, = struct.unpack_from("<H", rev_buf, pre_payload_len)
    #                 if write_efuse_len == size:
    #                     LOG_CRITICAL("write efuse addr 0x%x size 0x%x successfully!" % (addr, size))
    #                     return ERR_OK
    #                 else:
    #                     LOG_CRITICAL("write efuse addr 0x%x size 0x%x, but really written size is 0x%x" % (
    #                     addr, size, write_efuse_len))
    #                     return ERR_EFUSE_WRITTEN_LEN_MISMATCH
    #             else:
    #                 LOG_ERR("Error: write efuse status 0x%x" % status)
    #                 return ERR_DATA_UART_STATUS_FAIL
    #     else:
    #         LOG_ERR(
    #             "Error: to read CMD_WRITE_EFUSE_DATA rsp 0x%x bytes but read 0x%x bytes" % (rsp_cmd_fmt_size, len(rev_buf)))
    #         return ERR_DATA_UART_READ_FAIL
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
                    return ERR_OK
                else:
                    LOG_ERR("Error: flash init fail,status 0x%x." % status)
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR("Error: flash init rev timeout,need %d bytes,read %d bytes." % (
                rsp_cmd_fmt_size, len(rev_buf)))
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
                    if result == 24:  #FLASH_NOR_RET_SUCCESS=24
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
                    if result == FLASH_NOR_RET_SUCCESS:  #FLASH_NOR_RET_SUCCESS=24
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



    # def __generator_flash_ioctl(self, cmd_code, flash_ioctl_cmd, param1, param2, param3,
    #                           cmd_buf=None):
    #     if cmd_buf == None:
    #         cmd_buf = []
    #
    #     cmd_buf_part1_fmt = "<BH4I"
    #     cmd_buf_part1_fmt_size = struct.calcsize(cmd_buf_part1_fmt)
    #
    #     cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, flash_ioctl_cmd,
    #                                 param1, param2, param3)
    #
    #     crc_init = 0
    #     crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
    #
    #     cmd_buf_part2_fmt = "<H"
    #     cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
    #     cmd_buf_part2_fmt_size = struct.calcsize(cmd_buf_part2_fmt)
    #
    #     cmd_buf += list(cmd_buf_part1)
    #     cmd_buf += list(cmd_buf_part2)
    #     return (cmd_buf_part1_fmt_size + cmd_buf_part2_fmt_size)
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
    def get_rom_ver(self):
        if self._rom_ver == 0:
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
                    self._rom_ver = rom_ver&0xFF

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