Feature: Open Udemy Homepage

  Scenario: Verify Udemy homepage title
    Given I launch the browser
    When I open the Udemy homepage
    Then I should see the title contains "Udemy"
