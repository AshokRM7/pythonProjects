import { Container } from "../reusable/Container";

export const Footer = () => {
  return (
    <footer className="w-full bg-linear-to-r from-gradient-primary-start to-gradient-primary-end text-white py-4 shadow-lg shrink-0">
      <Container className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
        {/* Footer Text */}
        <p className="text-md text-center md:text-left">
          © 2025 Incident Intel. All rights reserved.
        </p>

        {/* Links */}
        <div className="flex space-x-4 text-md md:block hidden">
          <a href="#" className="hover:text-gray-200 transition">
            Privacy
          </a>
          <a href="#" className="hover:text-gray-200 transition">
            Terms
          </a>
          <a href="#" className="hover:text-gray-200 transition">
            Contact
          </a>
        </div>
      </Container>
    </footer>
  );
};
