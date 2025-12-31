from log import *

MP_CLI_VERSION = "v4.0.0.4"


def show_version():
    LOG_CRITICAL("meta tool mpcli version %s", MP_CLI_VERSION)


def get_version():
    return MP_CLI_VERSION
