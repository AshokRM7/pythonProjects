import configparser

def get_config():
    config = configparser.ConfigParser()
    config.read('config/config.properties')
    return config['DEFAULT']
