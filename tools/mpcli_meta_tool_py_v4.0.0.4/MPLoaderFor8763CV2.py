import time
import sys
import threading
import signal
from MPLoaderFor8763CV1 import MPLoaderFor8763CV1
from MPLoader_cmd_def import *
from crc import CRC
from mp_utility import *
from mp_setting import *

class HANDSHAKE_TYPE(IntEnum):
    RUN_MP_LOADER = 0x01
    RUN_HCI_MODE = 0x02

class MPLoaderFor8763CV2(MPLoaderFor8763CV1):
    def __init__(self, config, serialHdl):
        self._config = config
        self._serialHdl = serialHdl
        super(MPLoaderFor8763CV2, self).__init__(config, serialHdl)
        self._handshake_type = HANDSHAKE_TYPE.RUN_MP_LOADER
        self._cache_handshake_data = []
        self._stop_handshake = False
        self._sync_event = None
        self._wire_mode = TWO_WIRE_MODE

    def run_into_mp_loader(self):
        if not self.__mp_loader_waiting_for_connect():
            LOG_ERR("Error: fail to run into mp loader!")
            return ERR_RUN_INTO_MP_LOADER
        return ERR_OK

    # def read_mem(self,addr,size):
    #     return self._read_mem(addr,size)
    # def write_mem(self,addr,data):
    #     return self._mem_write(data,addr,len(data))

    def reboot(self):
        #self.test_bb2_misc_func()
        #get app euid
        #self.chip_erase()
        # return self.cmd_go()
        #self.cmd_get_propety()
        #self.read_app_euid()

        #test mem read and mem write
        # read_ret = self._read_mem(0x002802e4+0x44, 6)
        # print("{}".format(read_ret.hex()))
        #
        # self._mem_write([0x12,0x34,0x56,0x78,0x90,0xEF],0x002802e4+0x44,6)
        #
        # read_ret = self._read_mem(0x002802e4 + 0x44, 6)
        # print("{}".format(read_ret.hex()))
        #
        # efuse_data = self.read_efuse_data_on_phy(0x0,0x200)
        # print(efuse_data)
        # if type(efuse_data) != int:
        #     for i in range(32):
        #         print("{}".format(bytes(efuse_data[i*16:i*16+16]).hex()))

        return self._data_uart_reboot(REBOOT_TYPE.RESET_ALL.value)

    def set_handshake_run_hci_mode(self):
        self._handshake_type = HANDSHAKE_TYPE.RUN_HCI_MODE

    def get_handshake_type(self):
        return self._handshake_type

    def load_ram_patch(self,file_path):
        PATCH_MSG_LEN = self._config.CONFIG_LOAD_RAM_PATCH_PKT_SIZE

        LAST_PKT_FLAG = 1
        NOT_LAT_PKT_FLAG = 0
        pkt_flag = NOT_LAT_PKT_FLAG

        if not os.path.isfile(file_path):
            LOG_ERR("Error: ram patch image %s not exists!" % file_path)
            return ERR_FILE_NOT_EXIST

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            LOG_ERR("Error: ram patch image file size 0x%X is invalid!" % file_size)
            return ERR_IMG_SIZE_ZERO
        else:
            LOG_CRITICAL("start to loader ram patch image {} ...".format(file_path))

        try:
            fp = open(file_path, 'rb')
        except IOError as err:
            LOG_ERR("Error: open file {} fail, error: {}".format(file_path, err))
            return ERR_FILE_OPEN_FAIL

        if self._config.get_skip_hdr_for_rp():
            fp.seek(self._config.IMG_HDR_SIZE)
            file_size -= self._config.IMG_HDR_SIZE

        frag_num = file_size // PATCH_MSG_LEN
        if file_size % PATCH_MSG_LEN:
            frag_num += 1

        self._serialHdl.set_read_timeout(1)

        for i in range(frag_num):
            if i == frag_num - 1:
                cur_data_len = file_size - PATCH_MSG_LEN * i
                pkt_seq_num = i
                pkt_flag = LAST_PKT_FLAG
            else:
                cur_data_len = PATCH_MSG_LEN
                pkt_seq_num = i

            pkt_data = list(fp.read(cur_data_len))

            pkt_buf = []
            pkt_size = self.__generate_load_ram_patch(CmdID.CMD_LOAD_RAM_PATCH.value,
                                               pkt_flag,
                                               pkt_seq_num,
                                               cur_data_len,
                                               pkt_data,
                                               pkt_buf)
            if pkt_size == 0:
                LOG_ERR("Error: fail to generate load ram patch request message!")
                return ERR_GENERATE_CMD_FAIL

            '''retry '''
            retry_max_times = self._config.CONFIG_LOAD_RAM_PATCH_RETRY_MAX_TIMES
            try_times = retry_max_times
            is_retry = True

            while (is_retry and try_times > 0):
                try_times = try_times - 1
                if try_times != retry_max_times - 1:
                    LOG_CRITICAL(
                        "retry to load ram patch %d (pkt seq num 0x%x, last pkt flag 0x%x)" %
                        (retry_max_times - try_times, pkt_seq_num, pkt_flag))
                    time.sleep(1)

                written_len = self._serialHdl.write(pkt_buf, pkt_size)
                if written_len != pkt_size:
                    LOG_ERR(
                        "Error: load ram patch(pkt seq num 0x%x, last pkt flag 0x%x) to send %d bytes,but written_len is %d!" % (
                            pkt_seq_num, pkt_flag, pkt_size, written_len))
                    continue

                '''
                   mp response cmd{
                   B      MP_START_BYTE(0x87)
                   H      CmdID
                   B      status
                   I      payload_size
                   B      pkt seq
                   H      crc16
                   }
                   program reponse payload len is 1
                '''

                rsp_cmd_fmt = "<BHBI"
                rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)
                rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)
                if len(rev_buf) == rsp_cmd_fmt_size:
                    cmdIdRsp, = struct.unpack_from("<H", rev_buf, 1)
                    expected_rsp_id = CmdID.CMD_LOAD_RAM_PATCH.value
                    if cmdIdRsp != expected_rsp_id:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: wait for load ram patch rsp(pkt seq num 0x%x, last pkt flag 0x%x),but receive the response cmd code 0x%x" % (
                                pkt_seq_num, pkt_flag, cmdIdRsp))
                        continue
                    payload_size, = struct.unpack_from("<I", rev_buf,
                                                       struct.calcsize("<BHB"))
                    tail_buf = self._serialHdl.read(struct.calcsize("<{}BH".format(payload_size)))
                    rev_buf = bytes(list(rev_buf) + list(tail_buf))
                    if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                        LOG_DEBUG(list(rev_buf))
                        LOG_FATAL(
                            "Fatal: load ram patch rsp (pkt seq num 0x%x, last pkt flag 0x%x) crc checking fail!" % (
                            pkt_seq_num, pkt_flag))
                        continue
                    else:
                        STATUS_OFFSET = struct.calcsize("<BH")
                        status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                        if status == 0:
                            PKT_SEQ_OFFSET = struct.calcsize("<BHBI")
                            rsp_pkt_seq, = struct.unpack_from("<B", rev_buf,
                                                              PKT_SEQ_OFFSET)
                            if rsp_pkt_seq == pkt_seq_num:
                                LOG_DEBUG(
                                    "load ram patch pkt %d/%d, last pkt flag 0x%x) ok" % (
                                    pkt_seq_num, frag_num, pkt_flag))
                                is_retry = False
                            else:
                                LOG_ERR(
                                    "Error: load ram patch for pkt seq 0x%x, but rev rsp for pkt seq 0x%x" % (
                                    pkt_seq_num, rsp_pkt_seq))
                                continue
                        else:
                            LOG_DEBUG(list(rev_buf))
                            LOG_ERR(
                                "Error: load ram patch (pkt seq num 0x%x, last pkt flag 0x%x) fail,status 0x%x." % (
                                pkt_seq_num, pkt_flag, status))
                            continue

                else:
                    LOG_ERR(
                        "Error:rev load ram patch rsp (pkt seq num 0x%x, last pkt flag 0x%x)timeout!need %d bytes,read %d bytes." % (
                            pkt_seq_num, pkt_flag, rsp_cmd_fmt_size, len(rev_buf)))
                    continue

            add_load_ram_patch_retry_times(retry_max_times - try_times - 1)

            if is_retry == True:
                self._serialHdl.reset_read_timeout()
                return ERR_DATA_UART_LOAD_RAM_PATCH_FAIL
            else:
                LOG_DEBUG("load  %d/%d success!" % (pkt_seq_num, frag_num))
                continue

        self._serialHdl.reset_read_timeout()
        LOG_CRITICAL("============ load ram patch success!==============")
        time.sleep(0.1)
        return ERR_OK
    def set_wire_mode(self,wire_mode):
        self._wire_mode = wire_mode

    def get_wire_mode(self):
        return self._wire_mode

    def __generate_load_ram_patch(self, cmd_code, packet_flag, pkt_idx, data_len,
                                data_buf, cmd_buf=None):
        if cmd_buf == None:
            cmd_buf = []

        cmd_buf_part1_fmt = "<BH4BI%dB" % data_len
        cmd_buf_part1_fmt_size = struct.calcsize(cmd_buf_part1_fmt)

        if len(data_buf) != data_len:
            LOG_ERR("Error: generate load_ram_patch need %d bytes,but only %d bytes!" % (
            data_len, len(data_buf)))
            return 0

        cmd_buf_part1 = struct.pack(cmd_buf_part1_fmt, MP_START_BYTE, cmd_code, packet_flag,
                                    pkt_idx, 0, 0, data_len, *data_buf)

        crc_init = 0
        crc16 = CRC().btxfcs(crc_init, list(cmd_buf_part1))

        cmd_buf_part2_fmt = "<H"
        cmd_buf_part2 = struct.pack(cmd_buf_part2_fmt, crc16)
        cmd_buf_part2_fmt_size = struct.calcsize(cmd_buf_part2_fmt)

        cmd_buf += list(cmd_buf_part1)
        cmd_buf += list(cmd_buf_part2)
        return (cmd_buf_part1_fmt_size + cmd_buf_part2_fmt_size)

    def __reset(self):
        self._handshake_request_buf = []
        self._cache_handshake_data = []
        self._stop_handshake = False
        self._sync_event = None
        self._handshake_rst = False
        self._check_rsp_thread_hdl = None
        self._send_handshake_thread_hdl = None

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
                                                    elif wire_mode == TWO_WIRE_MODE or wire_mode == USB_DEV_MODE:
                                                        self._config.set_packet_size(
                                                            self._config.CONFIG_TWO_WIRE_UART_PKT_SIZE)
                                                        self._handshake_rst = True
                                                        self.set_wire_mode(TWO_WIRE_MODE)

                                                        LOG_CRITICAL("run into mp loader through two wire UART ok!")
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
                        break

            else:
                #need more data
                continue

        self._stop_handshake = True


    def read_disable_ram_patch_auth_val(self):
        mem_addr = 0x00205e40
        read_len = 0x4
        disable_ram_patch_auth_idx = 3
        disable_ram_patch_auth_mask = 0x30
        read_ret = self._read_mem(mem_addr,read_len)
        if type(read_ret) == bytes:
            disable_status = (read_ret[disable_ram_patch_auth_idx]&disable_ram_patch_auth_mask)<<2 #efuse on ram disable_ram_patch_auth variable
            if disable_status == 0:
                self._config.set_skip_hdr_for_rp(False)
            else:
                self._config.set_skip_hdr_for_rp(True)
            return ERR_OK
        elif read_ret == ERR_STATUS_AUTH_FAIL:
            self._config.set_skip_hdr_for_rp(False)
            return ERR_OK
        else:
            LOG_ERR("Error: read disable_ram_patch_auth status fail!")
            return read_ret

    def read_ecc_public_key(self):
        mem_addr = 0x00205dae
        read_len = 64

        read_ret = self._read_mem(mem_addr,read_len)
        if type(read_ret) == bytes:
            LOG_DEBUG("chip ECC public key:")
            ecc_public_key = "    {}".format(",".join([hex(n)[2:].upper() for n in list(read_ret)]))
            LOG_DEBUG(ecc_public_key)
            return read_ret
        else:
            LOG_ERR("Error: read chip ECC public key fail!")
            return read_ret

    def __generate_get_app_euid_cmd(self, cmd_code, cmd_buf):
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
    def read_euid(self):
        cmd_buf = []
        cmd_len = self.__generate_get_app_euid_cmd(CmdID.CMD_GET_APP_EUID.value+1,cmd_buf)

        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: read app euid to send %d bytes,but written_len is %d!" %
                (cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size (4 Bytes)
            payload_size*B  payload
            H      crc16
            }
            read app euid reponse payload len is 4 Bytes
        '''

        pre_payload_len = struct.calcsize("<BHBI")
        APP_EUID_SIZE = 14
        rsp_cmd_fmt = "<BHBI%dBH" % APP_EUID_SIZE
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)

        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            start_flag,cmdIdRsp, = struct.unpack_from("<BH", rev_buf,0)
            if start_flag != MP_START_BYTE:
                LOG_FATAL("Error: read app euid fail for the invalid start flag 0x%x" % start_flag)
                return ERR_REV_INVALID_START_FLAG

            expected_rsp_id = CmdID.CMD_GET_APP_EUID.value+1
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for read app euid response,but rev the rsp cmd code 0x%x" % cmdIdRsp)
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE

            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_FATAL("Fatal:read app euid response crc checking fail")
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    #app_euid = struct.unpack_from("<14B",rev_buf,pre_payload_len)
                    LOG_CRITICAL("EUID: {}".format(rev_buf[pre_payload_len:pre_payload_len+APP_EUID_SIZE]))
                    return rev_buf[pre_payload_len:pre_payload_len+APP_EUID_SIZE]
                else:
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            return ERR_DATA_UART_READ_FAIL
    def read_app_euid(self):
        cmd_buf = []
        cmd_len = self.__generate_get_app_euid_cmd(CmdID.CMD_GET_APP_EUID.value,cmd_buf)

        written_len = self._serialHdl.write(cmd_buf, cmd_len)
        if written_len != cmd_len:
            LOG_ERR(
                "Error: read app euid to send %d bytes,but written_len is %d!" %
                (cmd_len, written_len))
            return ERR_DATA_UART_WRITE_FAIL
        '''
            mp response cmd{
            B      MP_START_BYTE(0x87)
            H      CmdID
            B      status
            I      payload_size (4 Bytes)
            payload_size*B  payload
            H      crc16
            }
            read app euid reponse payload len is 4 Bytes
        '''

        pre_payload_len = struct.calcsize("<BHBI")
        APP_EUID_SIZE = 4
        rsp_cmd_fmt = "<BHBI%dBH" % APP_EUID_SIZE
        rsp_cmd_fmt_size = struct.calcsize(rsp_cmd_fmt)

        rev_buf = self._serialHdl.read(rsp_cmd_fmt_size)

        if len(rev_buf) == rsp_cmd_fmt_size:
            start_flag,cmdIdRsp, = struct.unpack_from("<BH", rev_buf,0)
            if start_flag != MP_START_BYTE:
                LOG_FATAL("Error: read app euid fail for the invalid start flag 0x%x" % start_flag)
                return ERR_REV_INVALID_START_FLAG

            expected_rsp_id = CmdID.CMD_GET_APP_EUID.value
            if cmdIdRsp != expected_rsp_id:
                LOG_DEBUG(list(rev_buf))
                LOG_FATAL(
                    "Fatal: wait for read app euid response,but rev the rsp cmd code 0x%x" % cmdIdRsp)
                return ERR_REV_UNEXPECTED_RSP_CMD_CODE

            if self.cmd_crc_check(rev_buf, len(rev_buf)) != 0:
                LOG_FATAL("Fatal:read app euid response crc checking fail")
                LOG_DEBUG(list(rev_buf))
                return ERR_CRC_CHK_FAIL
            else:
                STATUS_OFFSET = struct.calcsize("<BH")
                status, = struct.unpack_from("<B", rev_buf, STATUS_OFFSET)
                if status == 0:
                    app_euid = struct.unpack_from("<I",rev_buf,pre_payload_len)
                    LOG_CRITICAL("APP EUID: 0x%x"%app_euid)
                    return rev_buf[pre_payload_len:pre_payload_len+APP_EUID_SIZE]
                else:
                    return ERR_DATA_UART_STATUS_FAIL
        else:
            return ERR_DATA_UART_READ_FAIL
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
            expected_rsp_id = CmdID.CMD_FLASH_INIT.value
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



