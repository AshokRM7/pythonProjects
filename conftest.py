import pytest
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from utils.config_reader import get_config

@pytest.fixture(scope="class")
def setup(request):
    config = get_config()
    driver = webdriver.Chrome(ChromeDriverManager().install())
    driver.maximize_window()
    request.cls.driver = driver
    request.cls.config = config
    yield
    driver.quit()
