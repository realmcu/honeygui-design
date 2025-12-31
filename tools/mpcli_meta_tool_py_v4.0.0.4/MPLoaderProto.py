import sys
import time
from crc import CRC
from MPLoaderInterface import *
from MPLoader_cmd_def import *
from image_parser import *
from mp_utility import *

class MPLoaderProto(MPLoaderInterface):

    def __init__(self, config, serialHdl):
        self._config = config
        self._serialHdl = serialHdl

    def open(self, serialName, baudrate=115200):
        return self._serialHdl.open(serialName, baudrate)

    def close(self):
        self._serialHdl.close()

    def load_fw(self):
        return ERR_OK

    def set_baudrate(self, baudrate):
        LOG_DEBUG("send set baudrate command!")
        cmd_buf = []
        cmd_len = self.__generate_setbaudrate(CmdID.CMD_SET_BAUDRATE.value,
                                              0xFF,
                                              baudrate,
                                              cmd_buf)

        self._serialHdl.clear_trx_buf()
        self._serialHdl.set_read_timeout(self._config.CONFIG_SET_BAUDRATE_TIMEOUT_S)
        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            LOG_ERR("Error: set baudrate to send %d bytes,but written_len is %d!" % (
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
           set baudrate reponse payload len is 0 
        '''

        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        self._serialHdl.reset_read_timeout()
        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CmdID.CMD_SET_BAUDRATE.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL("Fatal: rev cmd code 0x%x,but expected 0x%x" % (
                    cmdIdRsp, expected_rsp_id))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE

            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("set baudrate command ok!")
                    self._serialHdl.set_baudrate(baudrate)
                    time.sleep(self._config.CONFIG_WAIT_FOR_BAUDRATE_CHANGE_S)

                    return ERR_OK
                else:
                    LOG_ERR(
                        "Error: set baudrate %d fail,status %d." % (baudrate, status))
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR(
                "Error:set baudrate receive evt timeout!need %d bytes,read %d bytes." % (
                    rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def chip_erase(self):
        cmd_buf = []
        cmd_buf_part1_fmt = "<BH"
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, CmdID.CMD_CHIP_ERASE.value)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)


        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send chip erase command!")
            return ERR_DATA_UART_WRITE_FAIL

        self._serialHdl.set_read_timeout(120)
        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        self._serialHdl.reset_read_timeout()

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CmdID.CMD_CHIP_ERASE.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for chip erase response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("chip erase ok")
                    return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: chip erase fail,status 0x%x." % ( status))
                    return ERR_DATA_UART_STATUS_FAIL

        else:
            LOG_ERR(
                "Error:chip erase receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL
    def cmd_go(self):
        cmd_buf = []
        cmd_buf_part1_fmt = "<BHII"
        addr = 0x330a
        param = 0x0
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, CmdID.CMD_GO.value,addr,param)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)


        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)

        written_len = self._serialHdl.write(cmd_buf, len(cmd_buf))

        if written_len != len(cmd_buf):
            LOG_ERR(
                "Error: fail to send cmd go command!")
            return ERR_DATA_UART_WRITE_FAIL

        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CmdID.CMD_GO.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for cmd go response,but rev rsp cmd code 0x%x" % (cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("cmd go ok")
                    return ERR_OK
                else:
                    LOG_DEBUG(list(rev_buf))
                    LOG_ERR(
                        "Error: chip erase fail,status %d." % (status))
                    return ERR_DATA_UART_STATUS_FAIL

        else:
            LOG_ERR(
                "Error:go receive timeout!need %d bytes,read %d bytes." % (rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

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

        rsp_cmd_fmt = "<BHBI16BH"
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
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("get propety ok")
                    LOG_CRITICAL("property info:{}".format(
                        ",".join([hex(n)[2:].upper() for n in list(rev_buf)])))

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
    def page_erase(self, addr, size):
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
        for blk_idx in range(blk_cnt):
            cmd_buf = []
            if (blk_idx == blk_cnt -1) and (remain_size > 0):
                erase_size = remain_size
            else:
                erase_size = blk_size
            cmd_len = self.__generate_erase_cmd(CmdID.CMD_PAGE_ERASE.value,
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
                    expected_rsp_id = CmdID.CMD_PAGE_ERASE.value
                    if cmdIdRsp != expected_rsp_id:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: wait for page erase(address 0x%x size 0x%x) response,but rev rsp cmd code 0x%x" % (
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
                            LOG_DEBUG("erase page(address 0x%x size 0x%x) ok" % (
                                blk_addr, erase_size))
                        else:
                            LOG_DEBUG(list(rev_buf))
                            LOG_ERR(
                                "Error: erase page(address 0x%x size 0x%x) fail,status %d." % (
                                    blk_addr, erase_size, status))
                            if status == 0x36:   #MP_STATUS_ADDR_RANGE_CHK_FAIL
                                LOG_ERR("    erase page size is out of flash range!")
                                break
                            continue

                else:
                    LOG_ERR(
                        "Error:erase page(address 0x%x size 0x%x) receive timeout!need %d bytes,read %d bytes." % (
                            addr, size, rsp_cmd_fmt_size, len(rev_buf)))
                    continue

            add_erase_retry_times(self._config.CONFIG_ERASE_RETRY_MAX_TIMES - try_times - 1)

            if is_retry == True:
                self._serialHdl.reset_read_timeout()
                return ERR_ERASE_FAIL
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

                continue
        if PRINT_PERCENT:
            if blk_idx + 1 == blk_cnt:
                LOG_DEBUG("\terase progress {}/{} {:.1%} ".format(blk_idx + 1,
                                                                     blk_cnt,
                                                                     (blk_idx + 1) / blk_cnt))

        self._serialHdl.reset_read_timeout()
        return ERR_OK

    def page_erase_single(self, addr, size):
        # only send one erase request
        if size == 0:
            LOG_CRITICAL("erase size is 0. Don't need to erase any flash space.")
            return ERR_OK

        cmd_buf = []
        cmd_len = self.__generate_erase_cmd(CmdID.CMD_PAGE_ERASE.value,
                                            addr,
                                            size,
                                            cmd_buf)

        '''adjust read timeout'''
        ADJUST_READ_TIMEOUT_FLAG = 1
        if size <= 0x2000:
            self._serialHdl.set_read_timeout(5)
        elif size >= 0x300000:
            self._serialHdl.set_read_timeout(60)
            LOG_CRITICAL("please wait for erasing flash ......")
        else:
            ADJUST_READ_TIMEOUT_FLAG = 0

        try_times = self._config.CONFIG_ERASE_RETRY_MAX_TIMES
        is_retry = True

        while (is_retry and try_times > 0):
            try_times = try_times - 1
            if try_times != self._config.CONFIG_ERASE_RETRY_MAX_TIMES - 1:
                LOG_CRITICAL("retry to erase %d (address 0x%x size 0x%x)" % (
                    self._config.CONFIG_ERASE_RETRY_MAX_TIMES - try_times, addr, size))
                time.sleep(1)

            written_len = self._serialHdl.write(cmd_buf, cmd_len)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: fail to send erase command data (address 0x%x size 0x%x)!" % (
                        addr, size))
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
                expected_rsp_id = CmdID.CMD_PAGE_ERASE.value
                if cmdIdRsp != expected_rsp_id:
                    LOG_DEBUG(list(rev_buf))
                    LOG_FATAL(
                        "Fatal: wait for page erase(address 0x%x size 0x%x) response,but rev rsp cmd code 0x%x" % (
                            addr, size, cmdIdRsp))
                    continue
                if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                    LOG_DEBUG(list(rev_buf))
                    continue
                else:
                    STATUS_OFFSET = struct.calcsize("<BH")
                    status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                    if status == 0:
                        is_retry = False
                        LOG_DEBUG("erase page(address 0x%x size 0x%x) ok" % (
                            addr, size))
                    else:
                        LOG_DEBUG(list(rev_buf))
                        LOG_ERR(
                            "Error: erase page(address 0x%x size 0x%x) fail,status %d." % (
                                addr, size, status))
                        continue
            else:
                LOG_ERR(
                    "Error:erase page(address 0x%x size 0x%x) receive timeout!need %d bytes,read %d bytes." % (
                        addr, size, rsp_cmd_fmt_size, len(rev_buf)))
                continue
        if ADJUST_READ_TIMEOUT_FLAG:
            self._serialHdl.reset_read_timeout()

        add_erase_retry_times(self._config.CONFIG_ERASE_RETRY_MAX_TIMES - try_times - 1)

        if is_retry == True:
            return ERR_ERASE_FAIL
        else:
            return ERR_OK
    def flash_program(self, dl_obj, dl_addr, dl_size):
        if dl_obj == None:
            return ERR_PROGRAM_OBJ_NONE

        if type(dl_obj) == str:
            return self.__flash_program_file(dl_obj, dl_addr, dl_size)
        elif type(dl_obj) == list:
            return self.__flash_program_buf(dl_obj, dl_addr, dl_size)
        else:
            raise Exception(
                "Error: don't support to program object type {}!".format(type(dl_obj)))
    def program(self, dl_obj, dl_addr, dl_size):
        return self.flash_program(dl_obj, dl_addr, dl_size)

    def flash_read(self, addr, rd_size, saveObj):
        if type(saveObj) == list:
            return self.__flash_read_into_buf(addr, rd_size, saveObj)
        if type(saveObj) == str:
            return self.__flash_read_as_file(addr, rd_size, saveObj)
        else:
            raise Exception("Error: Don't support saveobj type {}".format(type(saveObj)))
    def read(self, addr, rd_size, saveObj):
        pass
        # if type(saveObj) == list:
        #     return self.__flash_read_into_buf(addr, rd_size, saveObj)
        # if type(saveObj) == str:
        #     return self.__flash_read_as_file(addr, rd_size, saveObj)
        # else:
        #     raise Exception("Error: Don't support saveobj type {}".format(type(saveObj)))

    def flash_verify(self, img_path, img_addr):
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

                verify_ret = self.__flash_verify(img_addr, img_content_size,
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
    def verify(self, img_path, img_addr):
        return self.flash_verify(img_path, img_addr)

    def exit_mp_loader(self,mp_boot_type):
        LOG_WARNING("Warning: Don't support this command defaultly!")
        pass
    def reboot(self):
        return self._data_uart_reboot(REBOOT_TYPE.RESET_ALL.value)

    def waiting_for_connect(self):
        is_connected = False

        read_timeout_ms = self._config.CONFIG_FSBL_CON_READ_TIMEOUT_S
        cycle_delay_ms = self._config.CONFIG_FSBL_CON_DELAY_PER_CYCLE_MS
        total_wait_s = self._config.CONFIG_WAIT_FOR_CONNECT_FSBL_S

        self._serialHdl.set_read_timeout(read_timeout_ms / 1000)
        LOG_CRITICAL("please wait for connection...")
        log.stop_log()

        point_cnt = 0
        start_time = time.time()

        while (not is_connected) and (time.time() - start_time < total_wait_s):
            self._serialHdl.clear_trx_buf()
            if self.__handshake_into_mp_loader() == ERR_OK:
                is_connected = True
                break
            else:
                time.sleep(cycle_delay_ms / 1000)
                sys.stdout.write(".")
                point_cnt += 1
                if point_cnt % 60 == 0:
                    sys.stdout.write("\r\n")
                sys.stdout.flush()

        sys.stdout.write("\n")
        sys.stdout.flush()
        log.start_log()
        self._serialHdl.reset_read_timeout()
        time.sleep(0.05)
        self._serialHdl.clear_trx_buf()
        return is_connected

    def authenticate_through_password(self, dbg_passwd):

        enter_dbg_pwd_ret = self.__data_uart_enter_dbg_passwd(dbg_passwd)
        if enter_dbg_pwd_ret != ERR_OK:
            LOG_ERR("Error: enter_dbg_passwd fail!")
            return enter_dbg_pwd_ret

        reboot_ret = self._data_uart_reboot(REBOOT_TYPE.RESET_ALL_EXCEPT_AON.value)
        if reboot_ret != ERR_OK:
            LOG_ERR("Error: reboot except aon fail!")
            return reboot_ret
        return ERR_OK

    def cmd_crc_check(self, cmd_buf, cmd_len):
        crc_init = 0
        crc16_calced = CRC().btxfcs(crc_init, list(cmd_buf[:-2]))
        crc16_read, = struct.unpack_from("<H", bytes(cmd_buf), cmd_len - 2)
        if crc16_calced != crc16_read:
            LOG_ERR("Error: crc16 error! read 0x%04X != calced 0x%04X" % (
                crc16_read, crc16_calced))
            return ERR_CRC_CHK_FAIL
        return ERR_OK

    def detect_data_access(self):
        return self.__handshake_into_mp_loader()

    def __generate_enter_dbg_passwd_cmd(self, cmd_code, passwd, passwd_len, cmd_buf):
        cmd_fmt = "<BH%dB" % passwd_len
        part1_fmt_size = struct.calcsize(cmd_fmt)
        cmd_buf_part1 = struct.pack(cmd_fmt, MP_START_BYTE, cmd_code, *passwd)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (part1_fmt_size + part2_fmt_size)

    def __data_uart_enter_dbg_passwd(self, passwd):
        passwd_list = dbg_passwd_cpy(passwd)
        if len(passwd_list) != 16:
            LOG_ERR("Error: passwd must be 16 bytes hex data!")
            return ERR_DBG_PASSWD_FORMAT_INVALID

        cmd_buf = []
        cmd_len = self.__generate_enter_dbg_passwd_cmd(CmdID.CMD_ENTER_DBG_PWD.value,
                                                       passwd_list,
                                                       len(passwd_list),
                                                       cmd_buf)

        '''don't clear tx/rx buffer before send run hci mode request'''
        written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR("Error: uart run hci mode to send %d bytes,but written_len is %d!" % (
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
           enter debug password reponse payload len is 0
         '''

        rsp_cmd_fmt = "<BHBIH"
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        if len(rev_buf) == rsp_cmd_fmt_size:
            cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
            expected_rsp_id = CmdID.CMD_ENTER_DBG_PWD.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for CMD_ENTER_DBG_PWD response,but rev cmd code 0x%x" % (
                        cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_CRITICAL("enter dbg password OK!")
                    return ERR_OK
                else:
                    LOG_ERR("Error: enter_dbg_passwd fail,status %d." % status)
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR("Error: enter_dbg_passwd rev timeout,need %d bytes,read %d bytes." % (
                rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

    def __handshake_into_mp_loader(self):
        return self.__flash_read_into_buf(self._config.CONFIG_FLASH_START_ADDR, 0,
                                          is_handshake=True)

    def __generate_reboot_cmd(self, cmd_code, timeout_sec, cmd_buf):

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

    def _data_uart_reboot(self, reboot_type):
        cmd_buf = []
        cmd_len = self.__generate_reboot_cmd(CmdID.CMD_REBOOT.value,
                                             reboot_type,
                                             cmd_buf)

        LOG_DEBUG("reboot cmd req:")
        LOG_DEBUG(
            "{}".format(",".join([hex(n)[2:].upper() for n in list(cmd_buf)])))
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
            expected_rsp_id = CmdID.CMD_REBOOT.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL("Fatal: wait for CMD_REBOOT response,but rev cmd code 0x%x" % (
                    cmdIdRsp))
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE
            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    LOG_DEBUG(
                        "reboot cmd rsp:{}".format(",".join([hex(n)[2:].upper() for n in list(rev_buf)])))
                    LOG_CRITICAL("Reboot OK!")
                    return ERR_OK
                else:
                    LOG_ERR("Error: reboot fail,status %d." % status)
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            LOG_ERR("Error: reboot rev timeout,need %d bytes,read %d bytes." % (
                rsp_cmd_fmt_size, len(rev_buf)))
            return ERR_DATA_UART_READ_FAIL

    def __flash_read_as_file(self, addr, rd_size, save_file):
        pass
        '''
         read data on flash specified address, and save as binary file
        :param addr: read flash address
        :param rdSize: read buffer size
        :param saveFile: save file path
        :return: 0 ok, others: errcode
        '''

        # LOG_DEBUG("start CMD: savebin 0x%08x 0x%x %s" % (addr, rd_size, save_file))
        #
        # try:
        #     fp = open(save_file, 'wb+')
        # except IOError as err:
        #     LOG_ERR("Error: open save file %s fail." % save_file)
        #     LOG_ERR(err)
        #     return ERR_FILE_OPEN_FAIL
        #
        # PER_READ_SIZE = self._config.get_packet_size()
        # pkt_num = rd_size // PER_READ_SIZE
        # remain = rd_size % PER_READ_SIZE
        # if remain != 0:
        #     pkt_num += 1
        #
        # if rd_size >= 0x40000:
        #     LOG_CRITICAL("please wait for reading flash data ......")
        #
        # PRINT_PERCENT = False
        # if pkt_num >= 50:
        #     PRINT_PERCENT = True
        #     LOG_DEBUG("start to read address 0x%x size 0x%x" % (addr, rd_size))
        #
        # for pkt_idx in range(pkt_num):
        #     if pkt_idx != pkt_num - 1:
        #         pkt_size = PER_READ_SIZE
        #     else:
        #         if remain != 0:
        #             pkt_size = remain
        #         else:
        #             pkt_size = PER_READ_SIZE
        #
        #     rd_addr = addr + pkt_idx * PER_READ_SIZE
        #
        #     read_buf = []
        #     if self.__flash_read_into_buf(rd_addr, pkt_size, read_buf) == 0:
        #         fp.write(bytearray(read_buf))
        #         fp.flush()
        #
        #         if PRINT_PERCENT:
        #             if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
        #                 percent = (pkt_idx + 1) / pkt_num
        #                 LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
        #                     pkt_idx + 1, pkt_num, percent))
        #                 if pkt_idx + 1 == pkt_num:
        #                     PRINT_PERCENT = False
        #         LOG_DEBUG("    read 0x%08x len 0x%x ok" % (rd_addr, pkt_size))
        #
        #     else:
        #         LOG_ERR("Error:flash read 0x%08x size 0x%x fail." % (rd_addr, pkt_size))
        #         return ERR_HCI_READ_FAIL
        # fp.close()
        #
        # if PRINT_PERCENT:
        #     if pkt_idx + 1 == pkt_num:
        #         LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
        #             pkt_idx + 1, pkt_num, (pkt_idx + 1) / pkt_num))
        # LOG_DEBUG("save bin %s" % os.path.realpath(save_file))
        # return ERR_OK

    def __flash_read_into_buf(self, addr, data_len, read_buf=None, is_handshake=False):
        pass
        # PRINT_PERCENT = False
        # DATA_SIZE_PER_PACKET = self._config.get_packet_size()  # for gdma method 16K, if polling, set it to 32k
        #
        # pkt_cnt = 1 if is_handshake else (data_len + DATA_SIZE_PER_PACKET - 1) // DATA_SIZE_PER_PACKET
        #
        # if read_buf == None:
        #     read_buf = []
        #
        # if is_handshake == False:
        #     self._serialHdl.set_read_timeout(3)
        #     if data_len > DATA_SIZE_PER_PACKET:
        #         if data_len >= 0x40000:
        #             LOG_CRITICAL("please wait for reading flash data ......")
        #
        #         if pkt_cnt >= 50:
        #             PRINT_PERCENT = True
        #             LOG_DEBUG("start to read address 0x%x size 0x%x" % (addr, data_len))
        # else:
        #     self._serialHdl.set_read_timeout(0.5)
        #
        # for pkt_idx in range(pkt_cnt):
        #     cmd_buf = []
        #
        #     bytes_remain = data_len - (pkt_idx * DATA_SIZE_PER_PACKET)
        #     to_read_len = min(DATA_SIZE_PER_PACKET, bytes_remain)
        #
        #     to_read_address = addr + pkt_idx * DATA_SIZE_PER_PACKET
        #     cmd_len = self.__generate_flash_read_cmd(CmdID.CMD_READ.value,
        #                                              to_read_address,
        #                                              to_read_len,
        #                                              cmd_buf)
        #     total_retry_times = self._config.CONFIG_READ_RETRY_MAX_TIMES
        #     '''
        #        if the procedure is to read only 1 byte, it may be
        #        detecting connection procedure, and it will not retry!
        #     '''
        #     if to_read_len <= 1:
        #         total_retry_times = 1
        #
        #     try_times = total_retry_times
        #     is_retry = True
        #
        #     while (is_retry and try_times > 0):
        #         try_times = try_times - 1
        #         if try_times != total_retry_times - 1:
        #             LOG_CRITICAL("retry to read %d for address 0x%x size 0x%x" % (
        #                 total_retry_times - try_times, to_read_address, to_read_len))
        #             # delay 1 second in the retry mechanism between two request
        #             time.sleep(1)
        #
        #         written_len = self._serialHdl.write(cmd_buf, cmd_len)
        #         if written_len != cmd_len:
        #             LOG_ERR(
        #                 "Error: flash read(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" %
        #                 (to_read_address, to_read_len, cmd_len, written_len))
        #             continue
        #
        #         '''
        #              mp response cmd{
        #              B      MP_START_BYTE(0x87)
        #              H      CmdID
        #              B      status
        #              I      payload_size
        #              payload_size*B  payload
        #              H      crc16
        #              }
        #              flash read reponse payload len is the length requesting to read
        #           '''
        #
        #         pre_payload_len = struct.calcsize("<BHBI")
        #         rsp_cmd_fmt = "<BHBI%dBH" % to_read_len
        #         rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        #
        #         rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        #
        #         if len(rev_buf) == rsp_cmd_fmt_size or len(rev_buf) == 10:
        #             cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
        #             expected_rsp_id = CmdID.CMD_READ.value
        #             if cmdIdRsp != expected_rsp_id:
        #                 LOG_DEBUG(list(rev_buf))
        #                 LOG_FATAL(
        #                     "Fatal: wait for read response(address 0x%x size 0x%x),but rev the rsp cmd code 0x%x" %
        #                     (to_read_address, to_read_len, cmdIdRsp))
        #                 continue
        #             if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
        #                 LOG_FATAL(
        #                     "Fatal:read response(address 0x%x size 0x%x) crc checking fail" % (
        #                         to_read_address, to_read_len))
        #                 LOG_DEBUG(list(rev_buf))
        #                 continue
        #             else:
        #                 STATUS_OFFSET = struct.calcsize("<BH")
        #                 status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
        #                 if status == 0:
        #                     read_buf += rev_buf[
        #                                 pre_payload_len:pre_payload_len + to_read_len]
        #                     is_retry = False
        #                     if PRINT_PERCENT:
        #                         if (pkt_idx + 1) % (int(pkt_cnt * 0.1)) == 0:
        #                             percent = (pkt_idx + 1) / pkt_cnt
        #                             LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
        #                                 pkt_idx + 1, pkt_cnt, percent))
        #                             if pkt_idx + 1 == pkt_cnt:
        #                                 PRINT_PERCENT = False
        #                 else:
        #                     if is_handshake:
        #                         # just check crc and rsp command id for handshake
        #                         self._serialHdl.reset_read_timeout()
        #                         return ERR_OK
        #                     else:
        #                         LOG_ERR(
        #                             "Error: flash read (address 0x%08X size 0x%x) fail,status 0x%x." % \
        #                             (to_read_address, to_read_len, status))
        #                         if status == 0x36: #MP_STATUS_ADDR_RANGE_CHK_FAIL
        #                             LOG_ERR("flash read space is out of flash range!")
        #                             break
        #                         else:
        #                             continue
        #
        #         else:
        #
        #             LOG_ERR(
        #                 "Error:flash read(address 0x%08X size 0x%x) rev timeout!need %d bytes,read %d bytes." % \
        #                 (to_read_address, to_read_len, rsp_cmd_fmt_size, len(rev_buf)))
        #
        #             continue
        #     if total_retry_times != 1:
        #         add_read_retry_times(self._config.CONFIG_READ_RETRY_MAX_TIMES - try_times - 1)
        #
        #     if is_retry == True:
        #         self._serialHdl.reset_read_timeout()
        #         return ERR_FLASH_READ_FAIL
        #     else:
        #         continue
        #
        # self._serialHdl.reset_read_timeout()
        # if PRINT_PERCENT:
        #     if pkt_idx + 1 == pkt_cnt:
        #         LOG_DEBUG("\tread progress {}/{} {:.1%} ".format(
        #             pkt_idx + 1, pkt_cnt, (pkt_idx + 1) / pkt_cnt))
        # return ERR_OK

    def __flash_program_buf(self, data_buf, address, data_len):
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
        for pkt_idx in range(pkt_num):
            cmd_buf = []
            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET

            cmd_len = self.__generate_program(CmdID.CMD_PROGRAM.value,
                                              dl_addr,
                                              data_buf[(pkt_idx * DATA_SIZE_PER_PACKET):(
                                                      pkt_idx * DATA_SIZE_PER_PACKET + dl_size)],
                                              dl_size,
                                              cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_program fail.")
                return ERR_GENERATE_CMD_FAIL

            '''retry '''
            try_times = self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES
            is_retry = True

            while (is_retry and try_times > 0):
                try_times = try_times - 1
                if try_times != self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - 1:
                    LOG_CRITICAL("retry to program %d (address 0x%x size 0x%x)" %
                                 (self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - try_times,
                                  dl_addr,
                                  dl_size))
                    time.sleep(1)
                written_len = self._serialHdl.write(cmd_buf, cmd_len)
                if written_len != cmd_len:
                    LOG_ERR(
                        "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                            dl_addr, dl_size, cmd_len, written_len))
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
                   program reponse payload len is 0
                '''

                rsp_cmd_fmt = "<BHBIH"
                rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
                rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
                if len(rev_buf) == rsp_cmd_fmt_size:
                    cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
                    expected_rsp_id = CmdID.CMD_PROGRAM.value
                    if cmdIdRsp != expected_rsp_id:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: wait for program rsp(address 0x%x size 0x%x),but receive the response cmd code 0x%x" % (
                                dl_addr, dl_size, cmdIdRsp))
                        continue
                    if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: program rsp (address 0x%x size 0x%x) crc checking fail!" % (
                                dl_addr, dl_size))
                        continue
                    else:
                        STATUS_OFFSET = struct.calcsize("<BH")
                        status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                        if status == 0:
                            LOG_DEBUG("Program (address 0x%x size 0x%x) ok" % (
                                dl_addr, dl_size))
                            dl_addr += dl_size
                            is_retry = False

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
                            LOG_DEBUG(list(rev_buf))
                            LOG_ERR(
                                "Error: program (address 0x%08X size 0x%x) fail,status %d." % (
                                    dl_addr, dl_size, status))
                            continue

                else:
                    LOG_ERR(
                        "Error:rev program rsp (address 0x%x size 0x%x)timeout!need %d bytes,read %d bytes." % (
                            dl_addr, dl_size, rsp_cmd_fmt_size, len(rev_buf)))
                    continue

            add_program_retry_times(self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - try_times - 1)

            if is_retry == True:
                self._serialHdl.reset_read_timeout()
                return ERR_DOWNLOAD_IMG_FAIL
            else:
                continue

        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG(
                    "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
                                                              (pkt_idx + 1) / pkt_num))
        return ERR_OK

    def __flash_program_file(self, img_path, img_addr, img_content_size):
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

                program_ret = self.__flash_program_fp(img_addr, img_content_size, fp)
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

    def __flash_program_fp(self, address, data_len, fp):
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
        for pkt_idx in range(pkt_num):
            cmd_buf = []
            if pkt_idx != pkt_num - 1:
                dl_size = DATA_SIZE_PER_PACKET
            else:
                if data_len % DATA_SIZE_PER_PACKET != 0:
                    dl_size = (data_len % DATA_SIZE_PER_PACKET)
                else:
                    dl_size = DATA_SIZE_PER_PACKET

            cmd_len = self.__generate_program(CmdID.CMD_PROGRAM.value,
                                              dl_addr,
                                              list(fp.read(dl_size)),
                                              dl_size,
                                              cmd_buf)
            if cmd_len == 0:
                LOG_ERR("Error:generate_program fail.")
                return ERR_GENERATE_CMD_FAIL

            '''retry '''
            try_times = self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES
            is_retry = True

            while (is_retry and try_times > 0):
                try_times = try_times - 1
                if try_times != self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - 1:
                    LOG_CRITICAL("retry to program %d (address 0x%x size 0x%x)" %
                                 (self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - try_times,
                                  dl_addr,
                                  dl_size))
                    time.sleep(1)
                written_len = self._serialHdl.write(cmd_buf, cmd_len)
                if written_len != cmd_len:
                    LOG_ERR(
                        "Error: program(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                            dl_addr, dl_size, cmd_len, written_len))
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
                   program reponse payload len is 0
                '''

                rsp_cmd_fmt = "<BHBIH"
                rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
                rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
                if len(rev_buf) == rsp_cmd_fmt_size:
                    cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
                    expected_rsp_id = CmdID.CMD_PROGRAM.value
                    if cmdIdRsp != expected_rsp_id:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: wait for program rsp(address 0x%x size 0x%x),but receive the response cmd code 0x%x" % (
                                dl_addr, dl_size, cmdIdRsp))
                        continue
                    if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: program rsp (address 0x%x size 0x%x) crc checking fail!" % (
                                dl_addr, dl_size))
                        continue
                    else:
                        STATUS_OFFSET = struct.calcsize("<BH")
                        status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                        if status == 0:
                            LOG_DEBUG("Program (address 0x%x size 0x%x) ok" % (
                                dl_addr, dl_size))
                            dl_addr += dl_size
                            is_retry = False

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
                            LOG_DEBUG(list(rev_buf))
                            LOG_ERR(
                                "Error: program (address 0x%08X size 0x%x) fail,status %d." % (
                                    dl_addr, dl_size, status))
                            continue

                else:
                    LOG_ERR(
                        "Error:rev program rsp (address 0x%x size 0x%x)timeout!need %d bytes,read %d bytes." % (
                            dl_addr, dl_size, rsp_cmd_fmt_size, len(rev_buf)))
                    continue

            add_program_retry_times(self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - try_times - 1)

            if is_retry == True:
                self._serialHdl.reset_read_timeout()
                return ERR_DOWNLOAD_IMG_FAIL
            else:
                continue
        
        self._serialHdl.reset_read_timeout()
        if PRINT_PERCENT:
            if pkt_idx + 1 == pkt_num:
                LOG_DEBUG(
                    "\tprogram progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
                                                              (pkt_idx + 1) / pkt_num))
        return ERR_OK

    def __generate_flash_read_cmd(self, cmd_code, addr, data_len,
                                  cmd_buf=None):
        pass
        # if cmd_buf == None:
        #     cmd_buf = []
        #
        # cmd_buf_part1_fmt = "<BHII"
        # cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
        # cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, addr,
        #                             data_len)
        #
        # crc_init = 0
        # crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        # cmd_buf_part2_fmt = "<H"
        # cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        # cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)
        #
        # cmd_buf += list(cmd_buf_part1)
        # cmd_buf += list(cmd_buf_part2)
        #
        # return (cmd_buf_part1_size + cmd_buf_part2_size)

    def __generate_setbaudrate(self, cmd_code, timeout_sec, baudrate, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BHIB"
        cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, baudrate,
                                    timeout_sec)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))
        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (cmd_buf_part1_size + cmd_buf_part2_size)

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

    def __generate_program(self, cmd_code, addr, data_buf, data_len, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BHII%dB" % data_len
        cmd_buf_part1_fmt_size = struct.calcsize(cmd_buf_part1_fmt)

        if len(data_buf) != data_len:
            LOG_ERR("Error: generate program need %d bytes,but only %d bytes!" % (
                data_len, len(data_buf)))
            return 0

        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, addr,
                                    data_len, *data_buf)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_fmt_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (cmd_buf_part1_fmt_size + cmd_buf_part2_fmt_size)

    def __generate_flash_verify_cmd(self, cmd_code, addr, data_len, orign_crc16,
                                    cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BHIIH"
        cmd_buf_part1_size = struct.calcsize(cmd_buf_part1_fmt)
        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, addr,
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
    def __calculate_verify_time(self, data_len):
        verify_timeout = 40
        calc_timeout_s = ((data_len+0x100000-1)//0x100000)*6  # 1M bytes -> 5s
        if calc_timeout_s > 40:
            verify_timeout = calc_timeout_s + 10 # enlarge 10s

        return verify_timeout

    def __flash_verify(self, address, img_content_size, orign_crc16):
        cmd_buf = []
        cmd_len = self.__generate_flash_verify_cmd(CmdID.CMD_EFLASH_VERIFY.value,
                                                   address,
                                                   img_content_size,
                                                   orign_crc16,
                                                   cmd_buf)
        '''retry '''
        try_times = self._config.CONFIG_VERIFY_RETRY_MAX_TIMES
        is_retry = True

        verify_timeout_s = self.__calculate_verify_time(img_content_size)
        self._serialHdl.set_read_timeout(verify_timeout_s)
        while (is_retry and try_times > 0):
            try_times = try_times - 1
            if try_times != self._config.CONFIG_VERIFY_RETRY_MAX_TIMES - 1:
                LOG_CRITICAL("retry to verify %d (address 0x%x size 0x%x)" %
                             (self._config.CONFIG_VERIFY_RETRY_MAX_TIMES - try_times,
                              address,
                              img_content_size))
                time.sleep(1)

            written_len = self._serialHdl.write(cmd_buf, cmd_len)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: flash verify (address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
                        address, img_content_size, cmd_len, written_len))
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
                       flash verify reponse payload len is 0
            '''

            rsp_cmd_fmt = "<BHBIH"
            rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
            rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
            if len(rev_buf) == rsp_cmd_fmt_size:
                cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
                expected_rsp_id = CmdID.CMD_EFLASH_VERIFY.value
                if cmdIdRsp != expected_rsp_id:
                    LOG_DEBUG(list(rev_buf))
                    LOG_FATAL(
                        "Fatal: wait for verify response (address 0x%x size 0x%x),but rev rsp cmd code 0x%x" % (
                            address, img_content_size, cmdIdRsp))
                    continue
                if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                    LOG_DEBUG(list(rev_buf))
                    continue
                else:
                    STATUS_OFFSET = struct.calcsize("<BH")
                    status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                    if status == 0:
                        is_retry = False
                        LOG_DEBUG("flash verify (address 0x%08X size 0x%x) ok" % (
                            address, img_content_size))
                    else:
                        LOG_ERR(
                            "Error: flash verify (address 0x%08X size 0x%x) fail,status %d." % (
                                address, img_content_size, status))
                        LOG_CRITICAL(list(rev_buf))

                        add_verify_retry_times(self._config.CONFIG_VERIFY_RETRY_MAX_TIMES - try_times - 1)
                        self._serialHdl.reset_read_timeout()
                        return ERR_DATA_UART_STATUS_FAIL

            else:
                LOG_ERR(
                    "Error:flash verify (address 0x%08X size 0x%x) receive evt timeout!need %d bytes,read %d bytes." % (
                        address, img_content_size, rsp_cmd_fmt_size, len(rev_buf)))
                continue

        add_verify_retry_times(self._config.CONFIG_VERIFY_RETRY_MAX_TIMES - try_times - 1)
        self._serialHdl.reset_read_timeout()
        if is_retry == True:
            return ERR_VERIFY_FAIL
        else:
            return ERR_OK

    def _read_mem(self,read_addr,read_len):
        pass
        # cmd_buf = []
        # cmd_len = self.__generate_flash_read_cmd(CmdID.CMD_MEM_READ.value,
        #                                          read_addr,
        #                                          read_len,
        #                                          cmd_buf)
        #
        # '''retry '''
        # try_times = self._config.CONFIG_READ_RETRY_MAX_TIMES
        # is_retry = True
        #
        # ret_code = ERR_OK
        #
        # while (is_retry and try_times > 0):
        #     try_times = try_times - 1
        #     if try_times != self._config.CONFIG_READ_RETRY_MAX_TIMES - 1:
        #         LOG_CRITICAL("retry to read memory %d (address 0x%x size 0x%x)" %
        #                      (self._config.CONFIG_READ_RETRY_MAX_TIMES - try_times,
        #                       read_addr,
        #                       read_len))
        #         time.sleep(1)
        #
        #     written_len = self._serialHdl.write(cmd_buf, cmd_len)
        #     if written_len != cmd_len:
        #         LOG_ERR(
        #             "Error: mem read(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" %
        #             (read_addr, read_len, cmd_len, written_len))
        #         ret_code = ERR_DATA_UART_WRITE_FAIL
        #         continue
        #
        #     '''
        #         mp response cmd{
        #         B      MP_START_BYTE(0x87)
        #         H      CmdID
        #         B      status
        #         I      payload_size
        #         payload_size*B  payload
        #         H      crc16
        #         }
        #         flash read reponse payload len is the length requesting to read
        #     '''
        #
        #     pre_payload_len = struct.calcsize("<BHBI")
        #     rsp_cmd_fmt = "<BHBI%dBH" % read_len
        #     rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        #
        #     rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        #     if len(rev_buf) >= pre_payload_len:
        #         syncFlag, cmdIdRsp, status, rspLen, = struct.unpack("<BHBI",rev_buf[0:pre_payload_len])
        #         if syncFlag != MP_START_BYTE:
        #             LOG_FATAL("Fatal: rev rsp start flag 0x%x is not 0x87.".format(syncFlag))
        #             ret_code = ERR_REV_INVALID_START_FLAG
        #             continue
        #         if cmdIdRsp != CmdID.CMD_MEM_READ.value:
        #             LOG_DEBUG(list(rev_buf))
        #             LOG_FATAL(
        #                 "Fatal: wait for read response(address 0x%x size 0x%x),but rev the rsp cmd code 0x%x" %
        #                 (read_addr, read_len, cmdIdRsp))
        #             ret_code = ERR_REV_UNEXPECTED_RSP_CMD_CODE
        #             continue
        #
        #         if rspLen == 0:
        #             rsp_cmd_fmt_size = struct.calcsize("<BHBIH")
        #
        #         if len(rev_buf) == rsp_cmd_fmt_size:
        #             if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
        #                 LOG_FATAL(
        #                     "Fatal:read response(address 0x%x size 0x%x) crc checking fail" % (
        #                         read_addr, read_len))
        #                 LOG_DEBUG(list(rev_buf))
        #                 ret_code = ERR_CRC_CHK_FAIL
        #                 continue
        #             else:
        #                 if status == 0:
        #                     read_buf = rev_buf[pre_payload_len:pre_payload_len + read_len]
        #                     return read_buf
        #                 elif status == 0x11: #STATUS_CMD_AUTH_FAIL
        #                     ret_code = ERR_STATUS_AUTH_FAIL
        #                     return ret_code
        #                 else:
        #                     LOG_FATAL("Fatal: read response(address 0x%x size 0x%x) status 0x%x checking fail" % (
        #                         read_addr, read_len,status))
        #                     ret_code = ERR_DATA_UART_STATUS_FAIL
        #                     continue
        #     else:
        #         ret_code = ERR_DATA_UART_READ_FAIL
        #         continue
        #
        # return ret_code


    def _mem_write(self, data_buf, address, data_len):
        pass
        # DATA_SIZE_PER_PACKET = 1024
        #
        # pkt_num = data_len // DATA_SIZE_PER_PACKET
        # if data_len % DATA_SIZE_PER_PACKET != 0:
        #     pkt_num += 1
        #
        # dl_addr = address
        # dl_size = DATA_SIZE_PER_PACKET
        #
        # PRINT_PERCENT = False
        # if pkt_num >= 50:
        #     PRINT_PERCENT = True
        #     LOG_DEBUG("start to mem write address 0x%x size 0x%x" % (address, data_len))
        #
        # self._serialHdl.set_read_timeout(1)
        # for pkt_idx in range(pkt_num):
        #     cmd_buf = []
        #     if pkt_idx != pkt_num - 1:
        #         dl_size = DATA_SIZE_PER_PACKET
        #     else:
        #         if data_len % DATA_SIZE_PER_PACKET != 0:
        #             dl_size = (data_len % DATA_SIZE_PER_PACKET)
        #         else:
        #             dl_size = DATA_SIZE_PER_PACKET
        #
        #     cmd_len = self.__generate_program(CmdID.CMD_MEM_WRITE.value,
        #                                       dl_addr,
        #                                       data_buf[(pkt_idx * DATA_SIZE_PER_PACKET):(pkt_idx * DATA_SIZE_PER_PACKET + dl_size)],
        #                                       dl_size,
        #                                       cmd_buf)
        #     if cmd_len == 0:
        #         LOG_ERR("Error:generate mem write command fail.")
        #         return ERR_GENERATE_CMD_FAIL
        #
        #     '''retry '''
        #     try_times = self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES
        #     is_retry = True
        #
        #     while (is_retry and try_times > 0):
        #         try_times = try_times - 1
        #         if try_times != self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - 1:
        #             LOG_CRITICAL("retry to mem write %d (address 0x%x size 0x%x)" %
        #                          (self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - try_times,
        #                           dl_addr,
        #                           dl_size))
        #             time.sleep(1)
        #         written_len = self._serialHdl.write(cmd_buf, cmd_len)
        #         if written_len != cmd_len:
        #             LOG_ERR(
        #                 "Error: mem write(address 0x%x size 0x%x) to send %d bytes,but written_len is %d!" % (
        #                     dl_addr, dl_size, cmd_len, written_len))
        #             continue
        #
        #         '''
        #            mp response cmd{
        #            B      MP_START_BYTE(0x87)
        #            H      CmdID
        #            B      status
        #            I      payload_size
        #            payload_size*B  payload
        #            H      crc16
        #            }
        #            program reponse payload len is 0
        #         '''
        #
        #         rsp_cmd_fmt = "<BHBIH"
        #         rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
        #         rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
        #         if len(rev_buf) == rsp_cmd_fmt_size:
        #             cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
        #             expected_rsp_id = CmdID.CMD_MEM_WRITE.value
        #             if cmdIdRsp != expected_rsp_id:
        #                 LOG_DEBUG(list(rev_buf))
        #                 LOG_FATAL(
        #                     "Fatal: wait for mem write rsp(address 0x%x size 0x%x),but receive the response cmd code 0x%x" % (
        #                         dl_addr, dl_size, cmdIdRsp))
        #                 continue
        #             if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
        #                 LOG_DEBUG(list(rev_buf))
        #                 LOG_FATAL(
        #                     "Fatal: mem write rsp (address 0x%x size 0x%x) crc checking fail!" % (
        #                         dl_addr, dl_size))
        #                 continue
        #             else:
        #                 STATUS_OFFSET = struct.calcsize("<BH")
        #                 status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
        #                 if status == 0:
        #                     LOG_DEBUG("mem write (address 0x%x size 0x%x) ok" % (
        #                         dl_addr, dl_size))
        #                     dl_addr += dl_size
        #                     is_retry = False
        #
        #                     if PRINT_PERCENT:
        #                         if (pkt_idx + 1) % (int(pkt_num * 0.1)) == 0:
        #                             percent = (pkt_idx + 1) / pkt_num
        #                             LOG_DEBUG(
        #                                 "\tmem write progress {}/{} {:.1%} ".format(
        #                                     pkt_idx + 1,
        #                                     pkt_num, percent))
        #                             if pkt_idx + 1 == pkt_num:
        #                                 PRINT_PERCENT = False
        #                 else:
        #                     LOG_DEBUG(list(rev_buf))
        #                     LOG_ERR(
        #                         "Error: mem write (address 0x%08X size 0x%x) fail,status %d." % (
        #                             dl_addr, dl_size, status))
        #                     continue
        #
        #         else:
        #             LOG_ERR(
        #                 "Error:rev mem write rsp (address 0x%x size 0x%x)timeout!need %d bytes,read %d bytes." % (
        #                     dl_addr, dl_size, rsp_cmd_fmt_size, len(rev_buf)))
        #             continue
        #
        #     add_program_retry_times(self._config.CONFIG_PROGRAM_RETRY_MAX_TIMES - try_times - 1)
        #
        #     if is_retry == True:
        #         self._serialHdl.reset_read_timeout()
        #         return ERR_DOWNLOAD_IMG_FAIL
        #     else:
        #         continue
        #
        # self._serialHdl.reset_read_timeout()
        # if PRINT_PERCENT:
        #     if pkt_idx + 1 == pkt_num:
        #         LOG_DEBUG(
        #             "\tmem write progress {}/{} {:.1%} ".format(pkt_idx + 1, pkt_num,
        #                                                       (pkt_idx + 1) / pkt_num))
        # return ERR_OK

    def get_status_erase_before_program(self):
        return True


