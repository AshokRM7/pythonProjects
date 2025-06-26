import pytest
from pages.login_page import LoginPage

@pytest.mark.usefixtures("setup")
class TestLogin:

    def test_open_udemy(self):
        login = LoginPage(self.driver)
        login.open_url(self.config['base_url'])
        assert "Udemy" in login.get_title()
