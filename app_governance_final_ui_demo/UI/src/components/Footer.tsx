import React from 'react';
import { Shield, Mail, Phone, MapPin } from 'lucide-react';
import bofaLogo from '../assets/bofa-logo.png';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#012169] text-white mt-auto border-t-4 border-[#E31837]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center p-2 bg-white rounded-lg">
                <img src={bofaLogo} alt="Bank of America" className="w-8 h-auto object-contain" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Bank of America</h2>
                <p className="text-gray-300 text-sm">App Governance</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm max-w-md">
              Secure, reliable, and efficient ticket management for enterprise application governance.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4 uppercase tracking-wider text-xs">Security & Privacy</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-300 hover:text-white hover:underline transition">Privacy & Security</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white hover:underline transition">CA Privacy Notice</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white hover:underline transition">Online Banking Service Agreement</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white hover:underline transition">Ad Choices</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4 uppercase tracking-wider text-xs">Support</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-gray-300">
                <Phone className="w-4 h-4" /> 1-800-432-1000
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <Mail className="w-4 h-4" /> support@bankofamerica.com
              </li>
              <li className="flex items-center gap-2 text-gray-300">
                <MapPin className="w-4 h-4" /> Charlotte, NC
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-blue-800/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-400">
            <p>
              © {currentYear} Bank of America Corporation. All rights reserved. Member FDIC.
            </p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition">Careers</a>
              <a href="#" className="hover:text-white transition">Shareholders</a>
              <a href="#" className="hover:text-white transition">Sitemap</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
