import os
import sys
import logging
from err_def import *
import datetime
from configparser import *

class Logger(object):
    DEFAULT_LOG_SAVE_DAYS = 7
    DEFAULT_LOG_LEV = logging.ERROR

    def __init__(self):
        self.stop = False
        self.log = None

        '''log save days, log files exceeding the date will be deleted'''
        self.CONFIG_LOG_SAVE_DAYS = Logger.DEFAULT_LOG_SAVE_DAYS
        self.CONFIG_LOG_LEV = Logger.DEFAULT_LOG_LEV
        self.load_log_setting()

        '''init log'''
        self.init_log()

    def get_log_root_path(self):
        if getattr(sys, 'frozen', False):
            # 如果是打包后的可执行文件，使用sys.executable
            return os.path.dirname(sys.executable)
        else:
            # 如果是正常的脚本运行模式，使用__file__路径
            return os.path.dirname(os.path.abspath(__file__))

    def stop_log(self):
        self.stop = True

    def start_log(self):
        self.stop = False

    def get_log_level(self):
        return self.CONFIG_LOG_LEV

    def get_log_save_days(self):
        return self.CONFIG_LOG_SAVE_DAYS

    def get_handlers(self):
        return self.log.handlers

    def info(self, msg, *args, **kwargs):
        if self.stop:
            return None
        else:
            return self.log.info(msg, *args, **kwargs)

    def critical(self, msg, *args, **kwargs):
        return self.log.critical(msg, *args, **kwargs)

    def fatal(self, msg, *args, **kwargs):
        if self.stop:
            return None
        else:
            return self.log.fatal(msg, *args, **kwargs)

    def warning(self, msg, *args, **kwargs):
        if self.stop:
            return None
        else:
            return self.log.warning(msg, *args, **kwargs)

    def error(self, msg, *args, **kwargs):
        if self.stop:
            return None
        else:
            return self.log.error(msg, *args, **kwargs)

    def debug(self, msg, *args, **kwargs):
        if self.stop:
            return None
        else:
            return self.log.debug(msg, *args, **kwargs)

    def load_log_setting(self):
        configPath = os.path.join(self.get_log_root_path(), "config")
        self.logSettingIniName = "log_setting.ini"
        self.logSettingIniPath = os.path.join(configPath, self.logSettingIniName)

        self.config = ConfigParser(inline_comment_prefixes=['#', ';'])
        configFileList = [self.logSettingIniPath]
        try:
            readOK = self.config.read(configFileList)
            if readOK == configFileList:
                self.CONFIG_LOG_SAVE_DAYS = self.config.getint("log setting",
                                                            "log_save_days",
                                                            fallback=Logger.DEFAULT_LOG_SAVE_DAYS)
                log_lev = self.config.get("log setting", "log_level",fallback="ERROR" )
                if logging._nameToLevel.__contains__(log_lev):
                    self.CONFIG_LOG_LEV = logging._nameToLevel[log_lev]
                else:
                    raise Exception("Error: {} is not valid log level".format(log_lev))

        except Exception as err:
            self.CONFIG_LOG_SAVE_DAYS = Logger.DEFAULT_LOG_SAVE_DAYS
            self.CONFIG_LOG_LEV = Logger.DEFAULT_LOG_LEV

    def init_log(self):
        today = datetime.datetime.today()
        log_dir = os.path.join(self.get_log_root_path(), "log")
        log_dir = os.path.join(log_dir, today.strftime("%Y_%m_%d"))
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        else:
            self.remove_logs()

        self.log = logging.getLogger("mpcli")
        self.log.setLevel(logging.DEBUG)
        log_path = os.path.join(log_dir,
                                "mpcli%s.log" % today.strftime("%Y%m%d_%H%M%S%f"))

        log_fh = logging.FileHandler(log_path)

        log_fh.setLevel(logging.DEBUG)

        consol_hdl = logging.StreamHandler()
        consol_hdl.setLevel(self.get_log_level())

        formater = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        log_fh.setFormatter(formater)

        formater = logging.Formatter('%(message)s')
        consol_hdl.setFormatter(formater)

        self.log.addHandler(log_fh)
        self.log.addHandler(consol_hdl)
        return self.log

    def remove_logs(self):
        log_dir = os.path.join(self.get_log_root_path(), "log")
        if not os.path.exists(log_dir):
            return 0
        now = datetime.datetime.today()

        for parent, dirnames, filenames in os.walk(log_dir):
            remain = 0
            for file in filenames:
                if os.path.splitext(file)[-1] != ".log":
                    if file == ".DS_Store":
                        os.remove(os.path.join(parent, file))
                    else:
                        remain = 1
                    continue

                logtime = datetime.datetime.strptime(file[5:20], "%Y%m%d_%H%M%S")
                delta = (now - logtime).days
                if delta >= self.get_log_save_days():
                    os.remove(os.path.join(parent, file))
                else:
                    remain = 1
            parent_dir_name = os.path.split(parent)[-1]
            if parent_dir_name != "log" and remain == 0:
                dirtime = datetime.datetime.strptime(parent[-10:], "%Y_%m_%d")
                delta = (now - dirtime).days
                if delta >= self.get_log_save_days():
                    os.rmdir(parent)


log = Logger()
LOG_INFO = log.info
LOG_DEBUG = log.debug
LOG_WARNING = log.warning
LOG_ERR = log.error
LOG_FATAL = log.fatal
LOG_CRITICAL = log.critical
