package com.example.stockpoc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class StockWebSocketHandler extends TextWebSocketHandler {
    private static final String ADMIN_PATH = "/ws/admin";
    private final Map<String, WebSocketSession> clients = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> admins = new ConcurrentHashMap<>();
    private final Map<String, String> connectedAt = new ConcurrentHashMap<>();
    private final ObjectMapper mapper;
    private double price = 182.50;

    public StockWebSocketHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        if (isAdmin(session)) {
            admins.put(session.getId(), session);
            sendAdminSnapshot(session);
            return;
        }

        clients.put(session.getId(), session);
        connectedAt.put(session.getId(), Instant.now().toString());
        broadcastClients(Map.of("type", "status", "connectedDevices", clients.size(), "timestamp", Instant.now().toString()));
        broadcastAdminSnapshot();
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws IOException {
        if (admins.remove(session.getId()) != null) {
            return;
        }

        clients.remove(session.getId());
        connectedAt.remove(session.getId());
        broadcastClients(Map.of("type", "status", "connectedDevices", clients.size(), "timestamp", Instant.now().toString()));
        broadcastAdminSnapshot();
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        if (isAdmin(session)) {
            send(session, Map.of("type", "error", "message", "Admin endpoint is read-only."));
            return;
        }

        JsonNode incoming = mapper.readTree(message.getPayload());
        String text = incoming.path("message").asText("").trim();
        if (text.isEmpty()) {
            send(session, Map.of("type", "error", "message", "Provide a non-empty message."));
            return;
        }

        String messageId = incoming.path("messageId").asText("");
        String timestamp = Instant.now().toString();
        Map<String, Object> event = Map.of("type", "chat", "message", text, "timestamp", timestamp,
                "fromSessionId", session.getId());
        broadcastClients(event);
        var acknowledgement = new java.util.HashMap<String, Object>();
        acknowledgement.put("type", "ack");
        acknowledgement.put("message", "Message accepted and broadcast.");
        acknowledgement.put("timestamp", timestamp);
        if (!messageId.isBlank()) acknowledgement.put("messageId", messageId);
        send(session, acknowledgement);
        broadcastAdmin(Map.of("type", "clientMessage", "sessionId", session.getId(), "message", text,
                "timestamp", timestamp));
    }

    @Scheduled(fixedRate = 1000)
    public void publishPrice() throws IOException {
        price = Math.max(1, price + ThreadLocalRandom.current().nextDouble(-1.25, 1.26));
        broadcastClients(Map.of("type", "price", "symbol", "POC", "price", Math.round(price * 100.0) / 100.0,
                "change", Math.round(ThreadLocalRandom.current().nextDouble(-0.8, 0.81) * 100.0) / 100.0,
                "timestamp", Instant.now().toString(), "connectedDevices", clients.size()));
    }

    private boolean isAdmin(WebSocketSession session) {
        return session.getUri() != null && ADMIN_PATH.equals(session.getUri().getPath());
    }

    private void sendAdminSnapshot(WebSocketSession session) throws IOException {
        send(session, Map.of("type", "clients", "connectedDevices", clients.size(),
                "clients", clientDetails(), "timestamp", Instant.now().toString()));
    }

    private void broadcastAdminSnapshot() throws IOException {
        broadcastAdmin(Map.of("type", "clients", "connectedDevices", clients.size(),
                "clients", clientDetails(), "timestamp", Instant.now().toString()));
    }

    private ArrayList<Map<String, String>> clientDetails() {
        var result = new ArrayList<Map<String, String>>();
        for (WebSocketSession client : clients.values()) {
            String ip = client.getRemoteAddress() == null || client.getRemoteAddress().getAddress() == null
                    ? "unknown" : client.getRemoteAddress().getAddress().getHostAddress();
            String userAgent = client.getHandshakeHeaders().getFirst("User-Agent");
            result.add(Map.of("sessionId", client.getId(), "ip", ip,
                    "device", userAgent == null ? "unknown" : userAgent,
                    "connectedAt", connectedAt.getOrDefault(client.getId(), "unknown")));
        }
        return result;
    }

    private void send(WebSocketSession session, Object event) throws IOException {
        if (session.isOpen()) {
            synchronized (session) {
                session.sendMessage(new TextMessage(mapper.writeValueAsString(event)));
            }
        }
    }

    private void broadcastClients(Object event) throws IOException {
        broadcast(clients, event);
    }

    private void broadcastAdmin(Object event) throws IOException {
        broadcast(admins, event);
    }

    private void broadcast(Map<String, WebSocketSession> recipients, Object event) throws IOException {
        String json = mapper.writeValueAsString(event);
        for (WebSocketSession session : recipients.values()) {
            if (session.isOpen()) {
                try {
                    synchronized (session) {
                        session.sendMessage(new TextMessage(json));
                    }
                } catch (IOException exception) {
                    recipients.remove(session.getId());
                    session.close();
                }
            } else {
                recipients.remove(session.getId());
            }
        }
    }
}
