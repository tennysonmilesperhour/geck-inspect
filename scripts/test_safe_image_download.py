import unittest
from unittest.mock import MagicMock, patch

from safe_image_download import download_image_bytes, MAX_IMAGE_BYTES


class ImageDownloadTests(unittest.TestCase):
    @patch("safe_image_download.socket.getaddrinfo")
    def test_unsafe_urls_do_not_resolve(self, resolve):
        for url in ["http://example.com/a", "file:///etc/passwd", "https://u:p@example.com/a",
                    "https://example.com:8443/a", "https://example.com/\n"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                download_image_bytes(url)
        resolve.assert_not_called()

    @patch("safe_image_download.urllib3.HTTPSConnectionPool")
    @patch("safe_image_download.socket.getaddrinfo")
    def test_private_and_mixed_dns_rejected(self, resolve, pool):
        for ip in ["127.0.0.1", "10.0.0.1", "169.254.169.254", "224.0.0.1", "::1", "fc00::1", "::ffff:127.0.0.1"]:
            resolve.return_value = [(None, None, None, None, ("8.8.8.8", 443)),
                                    (None, None, None, None, (ip, 443))]
            with self.subTest(ip=ip), self.assertRaises(ValueError):
                download_image_bytes("https://images.example.com/a")
        pool.assert_not_called()

    @patch("safe_image_download.urllib3.HTTPSConnectionPool")
    @patch("safe_image_download.socket.getaddrinfo")
    def test_pinned_ip_tls_and_no_redirects(self, resolve, factory):
        resolve.return_value = [(None, None, None, None, ("8.8.8.8", 443))]
        response = MagicMock(status=200)
        response.read.return_value = b"image"
        factory.return_value.urlopen.return_value = response
        self.assertEqual(download_image_bytes("https://images.example.com/photo?q=1"), b"image")
        self.assertEqual(factory.call_args.args, ("8.8.8.8",))
        self.assertEqual(factory.call_args.kwargs["assert_hostname"], "images.example.com")
        self.assertEqual(factory.call_args.kwargs["server_hostname"], "images.example.com")
        self.assertEqual(resolve.call_count, 1)
        self.assertFalse(factory.return_value.urlopen.call_args.kwargs["redirect"])
        response.status = 302
        with self.assertRaises(ValueError):
            download_image_bytes("https://images.example.com/photo")
        response.status = 200
        response.read.return_value = b"x" * (MAX_IMAGE_BYTES + 1)
        with self.assertRaises(ValueError):
            download_image_bytes("https://images.example.com/photo")
        self.assertEqual(response.close.call_count, 3)


if __name__ == "__main__":
    unittest.main()
