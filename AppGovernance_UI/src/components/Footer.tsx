import { Shield, FileText, Phone, Mail, Globe } from 'lucide-react';
import boaLogo from '../assets/boa-logo.png';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm text-gray-900 mb-4">App Governance</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="#" className="hover:text-blue-900 transition-colors">Dashboard</a></li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">IAM Deliverables</a></li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">RISE Portal</a></li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">JIRA Integration</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm text-gray-900 mb-4">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><a href="#" className="hover:text-blue-900 transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">Process Flow</a></li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">Training Materials</a></li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">FAQs</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm text-gray-900 mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>1-800-555-0123</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>appgov@bofa.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <a href="#" className="hover:text-blue-900 transition-colors">Support Portal</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm text-gray-900 mb-4">Security & Compliance</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Security Policy</span>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Privacy Notice</span>
              </li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">Compliance Center</a></li>
              <li><a href="#" className="hover:text-blue-900 transition-colors">Audit Logs</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-8 pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={boaLogo} alt="Bank of America" className="h-6" />
            </div>

            <div className="flex items-center gap-6 text-xs text-gray-500">
              <a href="#" className="hover:text-blue-900 transition-colors">Terms of Use</a>
              <span>|</span>
              <a href="#" className="hover:text-blue-900 transition-colors">Privacy</a>
              <span>|</span>
              <a href="#" className="hover:text-blue-900 transition-colors">Security</a>
              <span>|</span>
              <a href="#" className="hover:text-blue-900 transition-colors">Accessibility</a>
            </div>
          </div>

          <div className="mt-4 text-center md:text-left">
            <p className="text-xs text-gray-500">
              © 2024 Bank of America Corporation. All rights reserved.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              This is a secure system. Unauthorized access is prohibited and will be prosecuted to the fullest extent of the law.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-900 py-1" style={{ backgroundColor: '#012169' }}>
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs text-white text-center">
            Member FDIC. Equal Housing Lender
          </p>
        </div>
      </div>
    </footer>
  );
}
