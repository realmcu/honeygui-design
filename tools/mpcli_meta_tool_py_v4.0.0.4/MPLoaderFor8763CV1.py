import threading
from MPLoaderProto import *
from crc import CRC
from err_def import *
import signal

from flash_ioctl_code_def import FLASH_IOCTL_CODE

class MPLoaderFor8763CV1(MPLoaderProto):
    def __init__(self, config, serialHdl):
        self._config = config
        self._serialHdl = serialHdl
        super(MPLoaderFor8763CV1, self).__init__(config, serialHdl)

        self._check_rsp_thread_hdl = None
        self._send_handshake_thread_hdl = None
        self._handshake_rst = False
        self._stop_handshake = False
        self._cache_handshake_data = []
        self._handshake_request_buf = []
        self._sync_event = None

    def run_into_mp_loader(self):
        if not self.__mp_loader_waiting_for_connect():
            LOG_ERR("Error: fail to run into mp loader!")
            return ERR_RUN_INTO_MP_LOADER
        return ERR_OK

    def spic_select(self):
        cmd_buf = []
        cmd_len = self.__generate_spic_select_cmd(CmdID.CMD_SPIC_SELECT.value,
                                           self._config.CONFIG_SPIC_SELECT_NUMBER,
                                           cmd_buf)
        '''retry '''
        try_cnt_max = self._config.CONFIG_SPIC_SELECT_TRY_CNT_MAX
        try_times = try_cnt_max
        is_retry = True

        self._serialHdl.set_read_timeout(0.1)
        while (is_retry and try_times > 0):
            try_times = try_times - 1
            if try_times != try_cnt_max - 1:
                LOG_CRITICAL("retry to spic select %d " %  (try_cnt_max - try_times))
                time.sleep(1)

            written_len = self._serialHdl.write(cmd_buf, cmd_len)
            if written_len != cmd_len:
                LOG_ERR(
                    "Error: uart spic select to send %d bytes,but written_len is %d!" % (
                    cmd_len, written_len))
                continue

            '''
               mp response cmd{
               B      MP_START_BYTE(0x87)
               H      CmdID
               B      status
               I      payload_size
               payload_size*B  payload (if payload_size is 0,it is without payload)
               H      crc16
               }
               SPIC select reponse payload len is 0
             '''

            rsp_cmd_fmt = "<BHBIH"
            rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
            rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
            if len(rev_buf) == rsp_cmd_fmt_size:
                if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                    continue
                else:
                    RSP_CMD_ID_OFFSET = 1
                    rsp_cmd_id, = struct.unpack_from("<H", rev_buf, RSP_CMD_ID_OFFSET)
                    expected_id =  CmdID.CMD_SPIC_SELECT.value
                    if rsp_cmd_id != expected_id:
                        LOG_ERR(
                            "Error: wait for response command id 0x%04x, but get 0x%04x" % \
                            (expected_id, rsp_cmd_id))
                        continue

                    STATUS_OFFSET = struct.calcsize("<BH")
                    status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                    if status == 0:
                        LOG_CRITICAL("spic select %d OK!" % self._config.CONFIG_SPIC_SELECT_NUMBER)
                        is_retry = False
                    else:
                        LOG_ERR("Error: spic select %d fail,status %d." % (
                        self._config.CONFIG_SPIC_SELECT_NUMBER, status))
                        continue
            else:
                LOG_ERR("Error: spic select %d timeout,need %d bytes,read %d bytes." % \
                        (self._config.CONFIG_SPIC_SELECT_NUMBER, rsp_cmd_fmt_size, len(rev_buf)))
                continue
        self._serialHdl.reset_read_timeout()
        if is_retry == False:
            return ERR_OK
        return ERR_SPIC_SELECT_FAIL

    def flash_init(self):
        cmd_buf = []
        cmd_len = self.__generator_flash_ioctl(CmdID.CMD_FLASH_IO_CTRL.value,
                                        FLASH_IOCTL_CODE.flash_ioctl_exec_flash_init.value,
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

        rsp_cmd_fmt = "<BHBIIH"
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
                    if result == 1:
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
                                        FLASH_IOCTL_CODE.flash_ioctl_exec_load_cfg.value,
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

        rsp_cmd_fmt = "<BHBIIH"
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
                    if result == 1:
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


    def __generator_flash_ioctl(self, cmd_code, flash_ioctl_cmd, param1, param2,
                              cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BH3I"
        cmd_buf_part1_fmt_size = struct.calcsize(cmd_buf_part1_fmt)

        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, flash_ioctl_cmd,
                                    param1, param2)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_fmt_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (cmd_buf_part1_fmt_size + cmd_buf_part2_fmt_size)


    def _send_handshake(self):
        point_cnt = 0
        while(not self._stop_handshake):
            if self._send_run_mp_load() != ERR_OK:
                LOG_ERR("Error: fail to send run mp loader request!")
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

        parse_step1 = True
        parse_step2 = False

        MAX_PAYLOAD_LEN = 2
        HANDSHAKE_RSP_MAX_SIZE = struct.calcsize("<BHBI{}BH".format(MAX_PAYLOAD_LEN))

        while not self._stop_handshake and \
                not self._sync_event.isSet():
            self._sync_event.wait(0.005)

        cmd_code, = struct.unpack_from("<H",bytearray(self._handshake_request_buf),1)

        LOG_CRITICAL(
            "handshake request:{}".format(",".join([hex(n)[2:].upper() for n in list(self._handshake_request_buf)])))

        while not self._stop_handshake:

            rev_buf = self._serialHdl.read()
            if len(rev_buf) > 0:
                LOG_CRITICAL(
                    "{}".format(",".join([hex(n)[2:].upper() for n in list(rev_buf)])))

                # check cli echo
                if len(rev_buf) >= len(self._handshake_request_buf):
                    is_echo = any([self._handshake_request_buf == list(rev_buf)[ i:i+len(self._handshake_request_buf)] \
                                   for i in range(0, len(rev_buf) - len(self._handshake_request_buf) + 1)])
                    if is_echo:
                        LOG_CRITICAL(
                            '''Note: receive handshake cli echo.The application cli is running!\r\n please reset the device manually!''')
                        continue

                if len(self._cache_handshake_data) == 0 and \
                        MP_START_BYTE not in list(rev_buf):
                    continue

                if len(rev_buf) > HANDSHAKE_RSP_MAX_SIZE:
                    is_try = any([self._handshake_request_buf[0:3] == list(rev_buf)[i:i + 3] \
                                       for i in range(0, len(rev_buf) - 3 + 1)])
                    if is_try == False:
                        LOG_CRITICAL('''Note: handshake procedure won't success in this status! please reset the device manually!''')
                        continue
                    else:
                        for i in range(0,len(rev_buf) - 3 + 1):
                            if self._handshake_request_buf[0:3] == list(rev_buf)[i:i + 3]:
                                rev_buf = rev_buf[i:]
                                break

                self._cache_handshake_data += list(rev_buf)

            elif parse_step1 == True and len(self._cache_handshake_data) >= rsp_hdr_size:
                pass
            else:
                continue

            if parse_step1:
                if len(self._cache_handshake_data) >= rsp_hdr_size:
                    start_flag,oper_code,status,payload_len = struct.unpack_from("<BHBI",bytes(self._cache_handshake_data))
                    if start_flag != MP_START_BYTE:
                        self._cache_handshake_data = self._cache_handshake_data[1:]  #skip the first byte
                        LOG_ERR("Error: check handshake response without start byte 0x87.")
                        continue

                    if oper_code != cmd_code:
                        self._cache_handshake_data = self._cache_handshake_data[1:]
                        LOG_ERR("Error: check handshake response operation code mismatch, 0x%x<->0x%x" % (oper_code,cmd_code))
                        continue
                    total_rsp_size = rsp_hdr_size + payload_len + rsp_tail_size

                    parse_step2 = True
                    parse_step1 = False

                    if len(self._cache_handshake_data) < total_rsp_size:
                        continue

            if parse_step2:
                if len(self._cache_handshake_data) < total_rsp_size:
                    continue
                else:
                    crc_valid = self.cmd_crc_check(bytes(self._cache_handshake_data[:total_rsp_size]),total_rsp_size)
                    if crc_valid != ERR_OK:
                        break
                    else:
                        if status != 0:
                            LOG_ERR("Error: check handshake response crc fail!")
                            break
                        else:
                            if payload_len == 0:
                                LOG_CRITICAL("run into mp loader through two wire UART ok!")
                                self._handshake_rst = True
                                break
                            elif payload_len == 1 or payload_len == 2:
                                WIRE_MODE_OFFSET = struct.calcsize("<BHBI")
                                SINGLE_WIRE_MODE = 1
                                TWO_WIRE_MODE = 2
                                wire_mode, = struct.unpack_from("<B", bytes(self._cache_handshake_data),
                                                                WIRE_MODE_OFFSET)

                                if wire_mode == SINGLE_WIRE_MODE:
                                    self._config.set_packet_size(self._config.CONFIG_SINGLE_WIRE_UART_PKT_SIZE)
                                    self._handshake_rst = True

                                    LOG_CRITICAL("run into mp loader through single wire UART ok!")
                                elif wire_mode == TWO_WIRE_MODE:
                                    self._config.set_packet_size(self._config.CONFIG_TWO_WIRE_UART_PKT_SIZE)
                                    self._handshake_rst = True

                                    LOG_CRITICAL("run into mp loader through two wire UART ok!")
                                else:
                                    LOG_ERR("Error: get unknown wire mode %d in mp loader handshake response"%wire_mode)
                                    break

                                if payload_len == 2:
                                    ACCSEE_FLAG_OFFSET = struct.calcsize("<BHBIB")
                                    access_flag, = struct.unpack_from("<B", rev_buf, ACCSEE_FLAG_OFFSET)
                                    LOG_CRITICAL("Access Flag 0x%x" % access_flag)

                                break
                            else:
                                LOG_ERR("Error: payload len(0x%x) in CMD_RUN_MP_LOADER response should be 0!" % payload_len)
                                break

        self._stop_handshake = True

    def _handshake_timer(self):
        self._stop_handshake = True

    def _stop_thread(self,signal, frame,):
        LOG_CRITICAL('You pressed Ctrl+C')
        self._stop_handshake = True

    def _thread_join(self,threads):
        is_thread_alive = False
        for t in threads:
            while 1:
                if sys.version_info[:2] > (3,8):
                    is_thread_alive = t.is_alive()
                else:
                    is_thread_alive = t.isAlive()
                if is_thread_alive:
                    time.sleep(0.05)
                else:
                    break

        for thread_hdl in threads:
            thread_hdl.join()

    def __reset(self):
        self._check_rsp_thread_hdl = None
        self._send_handshake_thread_hdl = None
        self._handshake_rst = False
        self._stop_handshake = False
        self._cache_handshake_data = []
        self._handshake_request_buf = []
        self._sync_event = None

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
            target=MPLoaderFor8763CV1._send_handshake,
            args=(self,),daemon=True)
        threads.append(self._send_handshake_thread_hdl)

        self._check_rsp_thread_hdl = threading.Thread(
            target=MPLoaderFor8763CV1.__check_handshake_rsp,
            args=(self,),daemon=True)
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
        signal.signal(signal.SIGINT,SIGINT_hdl)
        signal.signal(signal.SIGTERM, SIGTERM_hdl)
        return self._handshake_rst

    def _send_run_mp_load(self):

        cmd_buf = []
        if len(self._handshake_request_buf) == 0:
            cmd_len = self._generate_run_mp_loader_cmd(CmdID.CMD_RUN_MP_LOADER.value,
                                                       self._config.CONFIG_MP_LOADER_LOG_ENABLE,
                                                       cmd_buf)
            self._handshake_request_buf = cmd_buf
        else:
            cmd_buf = self._handshake_request_buf
            cmd_len = len(cmd_buf)

        '''don't clear tx/rx buffer before send run mp loader request'''
        written_len = self._serialHdl.write(cmd_buf, cmd_len, False)
        if written_len != cmd_len:
            LOG_ERR("Error: run mp loader to send %d bytes,but written_len is %d!" % (
                cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        return ERR_OK

    def _generate_run_mp_loader_cmd(self, cmd_code, log_enable, cmd_buf):
        cmd_fmt = "<BHB"
        part1_fmt_size = struct.calcsize(cmd_fmt)
        cmd_buf_part1 = struct.pack(cmd_fmt, MP_START_BYTE, cmd_code, log_enable)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (part1_fmt_size + part2_fmt_size)

    def __generate_spic_select_cmd(self, cmd_code, spic_num, cmd_buf):
        cmd_fmt = "<BHB"
        part1_fmt_size = struct.calcsize(cmd_fmt)
        cmd_buf_part1 = struct.pack(cmd_fmt, MP_START_BYTE, cmd_code, spic_num)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(part2_fmt, crc16)
        part2_fmt_size = struct.calcsize(part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (part1_fmt_size + part2_fmt_size)