#include <WiFiS3.h>
#include "mp3.h"
#include "rc_control.h"

const char* ssid = "Verizon_FYCW9R";
const char* password = "mavis4-dun-fax";

WiFiServer server(8080);

void setup() {
    Serial.begin(9600);

    // Connect WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("MAIN YIPPEE");
    Serial.println("\nWiFi connected. IP:");
    Serial.println(WiFi.localIP());

    server.begin();

    // Initialize modules
    mp3_init();
    car_init();
}

void loop() {
    WiFiClient client = server.available();
    if (client) {
        String line = client.readStringUntil('\r');
        while (client.available()) client.read();

        int start = line.indexOf("GET ");
        int end   = line.indexOf(" HTTP/");
        if (start != -1 && end != -1) {
            String path = line.substring(start + 4, end);

            if (path.startsWith("/mp3"))  mp3_handleRequest(path, client);
            if (path.startsWith("/drive")) car_handleRequest(path, client);
        }
        client.stop();
    }

    // Run module loops
    mp3_loop();
    car_loop();
}
