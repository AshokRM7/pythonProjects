from pages.login_page import LoginPage

def test_open_udemy(setup_driver):
    driver, config = setup_driver  # Unpack fixture
    page = LoginPage(driver)
    page.open_url(config['base_url'])
    assert "Udemy" in page.get_title()
