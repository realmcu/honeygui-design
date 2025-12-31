from DeviceCmdHdl import *
from serialHdl import *
from register import *
from flashFileParser import CFG_DICT_E,UART_ITEM_E
from flashAccessFilter import FlashAccessFilter
from image_parser import *
from hdl_occd_img import Handle_occd_img_agent
import time

class Device(object):
    def __init__(self, config, cmdParser):
        self._config = config
        self._cmdParser = cmdParser
        self._args = self._cmdParser.getArgs()

        self._serial_hdl = serial_handle(self._config)
        self._devCmdHdl = DeviceCmdHdl(self._config, self._serial_hdl)

        self._register = Register(self._cmdParser, self._devCmdHdl)
        self._flash_access_filter = FlashAccessFilter(self._config)
        self.total_dl_img_size = 0
        self.statistic_program_size = 0

    def disconnect(self):
        self._serial_hdl.close()

    def setup(self):
        # get access mode from cmdParser
        accessMode = self._cmdParser.getAccessMode()
        LOG_CRITICAL("determine mode as %s!!!" % get_mode_name(accessMode))

        # access device through different mode
        accessRet = self._register.setup(accessMode)
        if accessRet != ERR_OK:
            return accessRet

        return ERR_OK

    def cmdHdl(self):
        oper_ret = ERR_OK

        if self._cmdParser.is_download():
            # -a/-f, -p,-P : download
            oper_ret = self.flash_write()

        elif self._cmdParser.is_erase():
            oper_ret = self.flash_erase()
        elif self._cmdParser.is_chip_erase():
            oper_ret = self.flash_chip_erase()
        # elif self._cmdParser.is_modify():
        #     oper_ret = self.flash_modify()

        # elif self._args.hci_alive == True:
        #     oper_ret = self.__check_hci_alive()

        if self._cmdParser.is_flash_operation():
            self.__recover_flash_bp_lv()

        # if self._cmdParser.is_read_mem():
        #     oper_ret = self.read_mem()
        # if self._cmdParser.is_write_mem():
        #     oper_ret = self.write_mem()
        # if self._cmdParser.is_read_efuse():
        #     oper_ret = self.read_efuse()
        # if self._cmdParser.is_write_efuse():
        #     oper_ret = self.write_efuse()

        if self._cmdParser.is_reboot():
            reboot_ret = self.reboot()
            if reboot_ret != ERR_OK:
                LOG_ERR("reboot fail!")
                if oper_ret == ERR_OK:
                    oper_ret = reboot_ret
        if self._cmdParser.is_exit_mp_loader():
            oper_ret = self.exit_mp_loader()

        return oper_ret
    # def read_mem(self):
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl()
    #     if cmd_hdl != None:
    #         save_file = None
    #         if self._args.bin_file != None:
    #             save_file = self._args.bin_file
    #
    #         read_ret = cmd_hdl.read_mem(self._args.address,
    #                           self._args.flash_size,
    #                           save_file)
    #         if save_file == None:
    #             print("read mem 0x{:08x} size 0x{:08x}:".format(self._args.address,
    #                                                                 self._args.flash_size))
    #             if type(read_ret) == list:
    #                 print("{}".format(bytes(read_ret).hex()))
    #         return ERR_OK
    #     else:
    #         return ERR_GET_CMD_HDL_FAIL
    #
    # def write_mem(self):
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl()
    #     if cmd_hdl != None:
    #         ret = cmd_hdl.write_mem(self._args.address,self._args.modify_mem_bytes)
    #         if ret != ERR_OK:
    #             print("write mem fail {}!".format(ret))
    #             return ret
    #
    #         read_ret = cmd_hdl.read_mem(self._args.address,
    #                                     len(self._args.modify_mem_bytes))
    #         print("read back {}".format(read_ret.hex()))
    #         return ERR_OK
    #     else:
    #         return ERR_GET_CMD_HDL_FAIL
    #
    #
    # def read_efuse(self):
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl()
    #     if cmd_hdl != None:
    #         DATA_SIZE_PER_PACKET = 512  # for gdma method 16K, if polling, set it to 32k
    #         data_len = self._args.flash_size
    #         addr = self._args.address
    #         pkt_cnt = (data_len + DATA_SIZE_PER_PACKET - 1) // DATA_SIZE_PER_PACKET
    #
    #         fp = None
    #         if self._args.bin_file is None:
    #             return ERR_OK
    #         else:
    #             save_file = self._args.bin_file
    #             try:
    #                 fp = open(save_file, 'wb+')
    #             except IOError as err:
    #                 LOG_ERR("Error: open save file %s fail." % save_file)
    #                 LOG_ERR(err)
    #                 return ERR_FILE_OPEN_FAIL
    #
    #
    #         for pkt_idx in range(pkt_cnt):
    #             bytes_remain = data_len - (pkt_idx * DATA_SIZE_PER_PACKET)
    #             to_read_len = min(DATA_SIZE_PER_PACKET, bytes_remain)
    #             to_read_address = addr + pkt_idx * DATA_SIZE_PER_PACKET
    #
    #             efuse_data = cmd_hdl.read_efuse_data_on_phy(to_read_address, to_read_len)
    #
    #             if type(efuse_data) == list:
    #                 if fp != None:
    #                     fp.write(bytes(efuse_data))
    #                     continue
    #             else:
    #                 return efuse_data
    #         fp.close()
    #         return ERR_OK
    #     else:
    #         return ERR_GET_CMD_HDL_FAIL
    # def write_efuse(self):
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl()
    #     if cmd_hdl != None:
    #         ret = cmd_hdl.write_efuse_data(self._args.address,self._args.modify_efuse_bytes)
    #         if ret != ERR_OK:
    #             return ret
    #
    #         efuse_data = cmd_hdl.read_efuse_data_on_phy(self._args.address, len(self._args.modify_efuse_bytes))
    #
    #         if type(efuse_data) != int:
    #             return ERR_OK
    #         else:
    #             return efuse_data
    def reboot(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl()
        if cmd_hdl != None:
            return cmd_hdl.reboot()
        else:
            return ERR_GET_CMD_HDL_FAIL
    def exit_mp_loader(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl()
        if cmd_hdl != None:
            return cmd_hdl.exit_mp_loader(self._args.exit_mp_loader)
        else:
            return ERR_GET_CMD_HDL_FAIL

    # def flash_read(self):
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl()
    #     if cmd_hdl == None:
    #         return ERR_GET_CMD_HDL_FAIL
    #     rd_ret = cmd_hdl.read(self._args.address,
    #                           self._args.flash_size,
    #                           self._args.bin_file)
    #     if rd_ret != ERR_OK:
    #         LOG_DEBUG("-> Flash read fail, errcode: {}".format(rd_ret))
    #         rd_ret = ERR_SAVE_FAIL
    #
    #     LOG_CRITICAL("CMD: savebin 0x%08X  0x%x %s %s!" % (
    #                   self._args.address,
    #                   self._args.flash_size,
    #                   self._args.bin_file,
    #                  "ok" if rd_ret == ERR_OK else "fail"))
    #     return rd_ret

    def flash_write(self):
        cfgInfoDict = self._cmdParser.getCfgInfoDict()
        img_info_list = cfgInfoDict[CFG_DICT_E.JSON_INFO]

        disable_merge = self._cmdParser.is_disable_merge()

        if self.__get_total_imgs_size(img_info_list) == ERR_FILE_NOT_EXIST:
            LOG_ERR("Download : Failed | Error: fail to download image files!")
            return ERR_DOWNLOAD_IMG_FAIL

        total_img_cnt = len(img_info_list)

        dl_file_cnt = 0
        dl_file_size = 0
        skip_tip = ""
        for img_idx, image_info in enumerate(img_info_list):
            img_path = image_info[1]
            img_addr = image_info[0]

            img_size = os.path.getsize(img_path)

            if self._cmdParser.is_unlock_protection() == False:
                # without -u
                if self._flash_access_filter.eval_access(img_addr,
                                                         img_addr + img_size) == False:
                    strlog = "skip image {} [0x{:0>8x}, 0x{:0>8x})!\n".format( \
                        os.path.basename(img_path), img_addr, img_addr + img_size)
                    skip_tip += strlog
                    LOG_CRITICAL(strlog)
                    continue

            dl_img_ret = self.download_image(img_path, img_addr, disable_merge)
            if dl_img_ret != ERR_OK:
                LOG_ERR("Error: fail to download image {},address 0x{:0>8x}, errcode:{}".format(
                    image_info[1], image_info[0],dl_img_ret))
                LOG_ERR("Download : Failed | Error: fail to download image files!")
                return ERR_DOWNLOAD_IMG_FAIL

            else:
                dl_file_cnt += 1
                dl_file_size += image_parser_singleton.image_dl_content_size

                size_diff = image_parser_singleton.image_size - image_parser_singleton.image_dl_content_size
                if size_diff != 0:
                    self.total_dl_img_size -= size_diff

                LOG_CRITICAL("download {} ok! total progress {}/{} {:.1%}\n".format(
                             os.path.split(img_path)[-1],
                             img_idx + 1,
                             total_img_cnt,
                             dl_file_size / self.total_dl_img_size))

        if len(skip_tip) > 0:
            LOG_CRITICAL("statistic: total skip %d image:"%(total_img_cnt-dl_file_cnt))
            LOG_CRITICAL(skip_tip)
            LOG_CRITICAL("you can use -u to unlock the protection!")

        if dl_file_cnt > 0:
            LOG_CRITICAL(
                "Download : Success | %d image files have been downloaded successfully!" % dl_file_cnt)
            LOG_CRITICAL("download 0x{:08x} bytes".format(self.statistic_program_size))
        elif dl_file_cnt == 0:
            LOG_CRITICAL("Download : Failed | no files were downloaded!")
        return ERR_OK
    def flash_chip_erase(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl()
        if cmd_hdl == None:
            return ERR_GET_CMD_HDL_FAIL
        LOG_CRITICAL("start to chip erase : {}".format(datetime.datetime.now()))
        LOG_CRITICAL("please wait for about 40 seconds....")
        t1 = time.time()
        ret = cmd_hdl.chip_erase()
        t2 = time.time()
        LOG_CRITICAL("chip erase over {} in {:.3f}s {}".format(ret,t2-t1,datetime.datetime.now()))
        return  ret
    def flash_erase(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl()
        if cmd_hdl == None:
            return ERR_GET_CMD_HDL_FAIL
        args = self._args

        LOG_DEBUG("start to execute pageerase -A 0x%08x -S 0x%x, please wait ..." % (
            args.address, args.flash_size))

        check_ret = self.__check_flash_protection_space(args.address,
                                                        args.flash_size)
        if check_ret != ERR_OK:
            LOG_ERR("Error: erase flash fail! [0x{:0>8x},0x{:0>8x}) is in flash protection space!".format(args.address,args.address + args.flash_size))
            return check_ret

        ret_code = cmd_hdl.page_erase(args.address, args.flash_size)
        if ret_code != ERR_OK:
            ret_code = ERR_ERASE_FAIL
        LOG_CRITICAL("CMD: flash erase 0x%08x 0x%x  %s" % (args.address,
                                                         args.flash_size,
                                                         "ok" if ret_code == ERR_OK else "fail"))
        return ret_code

    # def flash_modify(self):
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl()
    #     if cmd_hdl == None:
    #         return ERR_GET_CMD_HDL_FAIL
    #
    #     modify_ret = self.__modify_flash_data(cmd_hdl,
    #                                           self._args.address,
    #                                           self._args.modify_bytes)
    #     if modify_ret != ERR_OK:
    #         LOG_DEBUG("-> Flash modify fail, errcode: {}".format(modify_ret))
    #         modify_ret = ERR_MODIFY_FAIL
    #     LOG_CRITICAL("CMD: modify 0x%08X %s %s!" % (
    #                   self._args.address,
    #                   self._cmdParser.get_modify_bytes(),
    #                   "ok" if modify_ret == ERR_OK else "fail"))
    #     return modify_ret

    def is_need_merge_img_next_ota_hdr(self,img_addr):
        align_4K_addr = (img_addr & 0xFFFFF000)
        if align_4K_addr == img_addr:
            return False
        else:
            return True

    # def read_and_merge_next_ota_header(self, img_file, img_addr):
    #     rd_ret = ERR_OK
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl()
    #     if cmd_hdl == None:
    #         return ERR_GET_CMD_HDL_FAIL
    #
    #     read_back_addr = (img_addr & 0xFFFFF000)
    #     read_back_size = 0x1000
    #     read_back_file = img_file+".tmp"
    #
    #     read_merge_file = img_file + ".mg"
    #     rd_ret = cmd_hdl.read(read_back_addr,
    #                           read_back_size,
    #                           read_back_file)
    #     if rd_ret != ERR_OK:
    #         LOG_DEBUG("-> Flash read fail, errcode: {}".format(rd_ret))
    #         rd_ret = ERR_SAVE_FAIL
    #
    #     fp_merge = open(read_merge_file, "wb")
    #     fp_rd = open(read_back_file, "rb")
    #     fp_dl = open(img_file, "rb")
    #
    #     mp_hdr_exist = image_parser_singleton.is_with_mp_hdr(img_file)
    #     if mp_hdr_exist:
    #         fp_dl.seek(MP_HEADER_SIZE)
    #
    #     if read_back_addr < img_addr: #write fsbl
    #         fp_merge.write(fp_rd.read(img_addr - read_back_addr))
    #         fp_merge.write(fp_dl.read())
    #         fp_merge.flush()
    #         fp_merge.close()
    #     elif read_back_addr == img_addr:
    #         if  image_parser_singleton.is_ota_hdr:
    #             fp_merge.write(fp_dl.read())
    #             fp_rd.seek(0x400)
    #             fp_merge.write(fp_rd.read())
    #             fp_merge.flush()
    #             fp_merge.close()
    #         else:
    #             fp_merge.write(fp_dl.read())
    #             fp_merge.flush()
    #             fp_merge.close()
    #     else:
    #         LOG_ERR("Error: it can't run here 0x{:x} 0x{:x}".format(read_back_addr,img_addr))
    #         rd_ret = ERR_INVALID_PARAM
    #
    #     fp_rd.close()
    #     fp_dl.close()
    #     os.remove(read_back_file)
    #
    #     return rd_ret


    def download_image(self, img_file, img_addr, disable_merge=0, mac_addr=""):
        # get image content size to be downloaded on flash
        retCode = image_parser_singleton.parse(img_file)
        if retCode != 0:
            LOG_ERR("Error: %s image format is inconformity!" % img_file)
            return retCode

        if image_parser_singleton.is_with_mp_hdr(img_file) == False:
            if img_addr == self._config.get_occd_img_addr():
                image_parser_singleton.set_OCCD_image()
            else:
                # for unaligned 4KB image ota +fsbl downloading
                if self._config.IMG_HDR_SIZE == 0x400:
                    image_parser_singleton.parse_img_id(img_file, self._config.IMG_HDR_SIZE)

        img_content_size = image_parser_singleton.image_dl_content_size

        LOG_CRITICAL("to download: address 0x%08X size 0x%x %s" % (
            img_addr, img_content_size, img_file))
        self.statistic_program_size += img_content_size

        if not image_parser_singleton.is_OCCD_image:
            dl_ret = self.__download_e_p_v(img_file, img_addr, img_content_size)
            if dl_ret != ERR_OK:
                LOG_ERR("Error: fail to download image %s on address 0x%08X." % (
                    img_file, img_addr))
                return ERR_FLASH_DOWNLOAD_FAIL
            else:
                return ERR_OK
        else:
            cmd_hdl = self._devCmdHdl.get_cmd_hdl()
            if cmd_hdl == None:
                return ERR_GET_CMD_HDL_FAIL

            occd_img_handle = Handle_occd_img_agent(self._config, self._cmdParser, cmd_hdl).getOccdHdl()
            retCode = occd_img_handle.download_occd_image(img_file, img_addr, mac_addr,
                                                          disable_merge)
            return retCode

    def __modify_flash_data(self,cmd_hdl,address,new_byte_list):
        FLASH_PAGE_SIZE = 0x1000
        offset = address % FLASH_PAGE_SIZE  # 4KBytes aligned
        address -= offset

        read_buf = []
        read_ret = cmd_hdl.read(address, FLASH_PAGE_SIZE, read_buf)
        if read_ret != ERR_OK:
            LOG_ERR("Error: read 0x10000 bytes at 0x%08X fail!" % address)
            return read_ret
        else:
            for i in range(len(new_byte_list)):
                read_buf[offset + i] = new_byte_list[i]
            LOG_DEBUG("read back 0x{:x} bytes at 0x{:0>8x} and modify data ok!".format(
                FLASH_PAGE_SIZE, address))

        check_ret = self.__check_flash_protection_space(address, FLASH_PAGE_SIZE)
        if check_ret != ERR_OK:
            return check_ret

        erase_ret = cmd_hdl.page_erase(address, FLASH_PAGE_SIZE)
        if erase_ret != ERR_OK:
            LOG_ERR("Error: erase page at 0x%x fail." % address)
            return erase_ret
        else:
            LOG_DEBUG("erase page at 0x%x size 0x%x ok!" % (
                address, FLASH_PAGE_SIZE))

        program_ret = cmd_hdl.program(read_buf, address, FLASH_PAGE_SIZE)
        if program_ret != ERR_OK:
            LOG_ERR("Error: program at 0x%08x fail in modify procedure!" % address)
            return program_ret
        else:
            LOG_DEBUG("program page address 0x{:0>8x} ok!".format(address))
        return ERR_OK

    def __check_flash_protection_space(self, addr, size):
        src_addr = addr
        src_size = size
        if self._cmdParser.is_unlock_protection() == False:
            # without -u
            if self._flash_access_filter.eval_access(addr, addr + size) == False:
                LOG_CRITICAL("you can use -u to unlock the protection!")
                return ERR_ERASE_PROTECTION_SPACE
        return ERR_OK

    def __download_e_p_v(self, img_file, img_addr, img_content_size):
        # 1.erase
        # get image size and extend to its 4K boundary
        payload_len = (img_content_size + 4096 - 1) // 4096 * 4096

        if payload_len > self._config.CONFIG_FLASH_SIZE_MAX:
            LOG_ERR("Error:please check the file content size 0x%x for %s" % (
                img_content_size, img_file))
            return ERR_IMG_SIZE_EXCEED_FLASH_SIZE

        LOG_DEBUG("start CMD:erase page 0x%08x 0x%x" % (img_addr, payload_len))

        cmd_hdl = self._devCmdHdl.get_cmd_hdl()
        if cmd_hdl == None:
            return ERR_GET_CMD_HDL_FAIL

        t1 = time.time()
        if cmd_hdl.get_status_erase_before_program():
            erase_addr = img_addr
            if  (img_addr & 0xFFFFF000) !=  img_addr:
                erase_addr = ((img_addr+0x1000)&0xFFFFF000)
                LOG_DEBUG("{} is placed on unaligned address 0x{:08x}, update erase address to 0x{:08x}!".format(
                    img_file,img_addr,erase_addr))
                
            erase_ret = cmd_hdl.page_erase(erase_addr, payload_len)

            t2 = time.time()
            if erase_ret != ERR_OK:
                LOG_ERR("Error: fail to erase (address = 0x%08x, len = 0x%x)." % (
                    erase_addr, payload_len))
                return erase_ret
            else:
                LOG_CRITICAL("CMD:erase 0x%08x 0x%x  ok" % (erase_addr, payload_len))
        else:
            t2 = t1

        # 2.program file address
        LOG_DEBUG(
            "start CMD:program 0x%08x 0x%x %s" % (img_addr, img_content_size, img_file))
        t3 = time.time()
        program_ret = cmd_hdl.program(img_file, img_addr, img_content_size)
        t4 = time.time()
        if program_ret != ERR_OK:
            LOG_ERR("Error: fail to program image %s on address 0x%08X." % (
                img_file, img_addr))
            return program_ret
        else:
            LOG_CRITICAL("CMD:program 0x%08x 0x%x %s  ok" % (
                img_addr, img_content_size, os.path.split(img_file)[-1]))

        # 3.verify flash file
        LOG_DEBUG("start CMD:flash verify 0x%08x 0x%x %s" % (
            img_addr, img_content_size, img_file))
        t5 = time.time()
        verify_ret = cmd_hdl.verify(img_file, img_addr)
        t6 = time.time()
        if verify_ret != ERR_OK:
            LOG_ERR("Error: fail to verify image %s on flash address 0x%08X." % (
                img_file, img_addr))
            return verify_ret
        else:
            LOG_CRITICAL(
                "CMD:flash verify 0x%08x 0x%x %s ok" % (
                    img_addr, img_content_size, os.path.split(img_file)[-1]))
        LOG_DEBUG("erase {} s".format(t2-t1))
        LOG_DEBUG("program {} s".format(t4 - t3))
        LOG_DEBUG("verify {} s  total {} s".format(t6 - t5,t6-t1))
        return ERR_OK

    def __get_total_imgs_size(self, img_info_list):
        if self.total_dl_img_size != 0:
            return self.total_dl_img_size
        else:
            self.total_dl_img_size = 0
            for img_info in img_info_list:
                img_addr = img_info[0]
                img_path = img_info[1]
                if not os.path.isfile(img_path):
                    LOG_ERR("Error: image {} not exists!".format(img_path))
                    self.total_dl_img_size = 0
                    return ERR_FILE_NOT_EXIST
                img_size = os.path.getsize(img_path)
                if self._cmdParser.is_unlock_protection() == False:
                    if self._flash_access_filter.eval_access(img_addr, img_addr + img_size,True) == False:
                        continue

                self.total_dl_img_size += img_size
            return self.total_dl_img_size

    def __check_hci_alive(self):
        cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)

        log.stop_log()
        check_mode_ret = cmd_hdl.check_mode()
        log.start_log()
        if check_mode_ret != ERR_OK:
            LOG_ERR("Error: device is not alive in hci mode!")
        else:
            LOG_CRITICAL("device is alive in hci mode!")
        cmd_hdl.close()

    # def __autoDetectMode(self):
    #     LOG_CRITICAL("\nwithout -M, start to detect access mode...")
    #     cfgInfoDict = self._cmdParser.getCfgInfoDict()
    #
    #     cmd_hdl = self._devCmdHdl.get_cmd_hdl(HCI_UART)
    #     open_ret = cmd_hdl.open(self._args.comport,cfgInfoDict[CFG_DICT_E.SERIAL_INFO][UART_ITEM_E.OPEN_BAUDRATE])
    #     if open_ret != ERR_OK:
    #         LOG_ERR("Error: open %s fail!" % self._args.comport)
    #         return ERR_SERIAL_OPEN_FAIL
    #
    #     load_fw_ret = cmd_hdl.load_fw()
    #     if load_fw_ret != ERR_OK:
    #         LOG_ERR("Error: load firmware fail!")
    #         cmd_hdl.close()
    #         return load_fw_ret
    #
    #     mode_ret = cmd_hdl.read_efuse_data()
    #     if mode_ret < 0:
    #         cmd_hdl.close()
    #         return ERR_MISS_M_FLAG
    #     else:
    #         self._cmdParser.setAccessMode(mode_ret)
    #         cmd_hdl.close()
    #         return ERR_OK

    def __recover_flash_bp_lv(self):
        uart_type = self._devCmdHdl.get_uart_type()
        if uart_type == HCI_UART:
            cmd_hdl = self._devCmdHdl.get_cmd_hdl()
            return cmd_hdl.flash_lock()
        return ERR_OK

