import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Radio, Wifi, WifiOff } from 'lucide-react';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function App() {
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState(0);
  const [price, setPrice] = useState(182.5);
  const [change, setChange] = useState(0);
  const [ticks, setTicks] = useState([]);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [messageAck, setMessageAck] = useState('');
  const socketRef = useRef(null);

  useEffect(() => {
    let socket;
    let retry;
    let disposed = false;
    const connect = () => {
      const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(`${scheme}//${window.location.host}/ws`);
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!disposed) retry = window.setTimeout(connect, 1500);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data);
          if (Number.isFinite(event.connectedDevices)) setDevices(event.connectedDevices);
          if (event.type === 'price') {
            setPrice(event.price);
            setChange(event.change);
            setTicks((previous) => [{ ...event, id: `${event.timestamp}-${Math.random()}` }, ...previous].slice(0, 8));
          }
          if (event.type === 'chat') {
            setChat((previous) => [...previous, { ...event, id: `${event.timestamp}-${Math.random()}` }].slice(-8));
          }
          if (event.type === 'ack') setMessageAck(event.message);
        } catch (error) {
          console.error('Invalid WebSocket message', error);
        }
      };
    };
    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const sendMessage = (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: 'chat', message: text }));
    setMessage('');
  };

  const positive = change >= 0;
  const chart = useMemo(() => {
    const points = [...ticks].reverse();
    if (!points.length) return '0,100 100,100';
    const prices = points.map((tick) => tick.price);
    const min = Math.min(...prices) - 0.5;
    const max = Math.max(...prices) + 0.5;
    return prices.map((value, index) => `${(index / Math.max(1, prices.length - 1)) * 100},${100 - ((value - min) / (max - min)) * 80}`).join(' ');
  }, [ticks]);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><Activity size={19} /></span><span>pulse<span className="brand-dot">.</span></span></a>
        <div className="top-meta"><span className="eyebrow">REAL-TIME WEBSOCKET DEMO</span><span className={`connection ${connected ? 'online' : ''}`}><i />{connected ? 'STREAM LIVE' : 'RECONNECTING'}</span></div>
      </header>

      <section className="intro">
        <div className="intro-copy"><span className="overline"><span className="overline-line" /> MARKET SIMULATOR</span><h1>Signals in<br /><span>real time.</span></h1><p>A live feed for every connected device.<br />Watch the market move, tick by tick.</p></div>
        <div className="orbital"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit orbit-three"/><div className="orbit-core"><Activity size={25}/></div><span className="orbit-node node-one"/><span className="orbit-node node-two"/><span className="orbit-node node-three"/><div className="orbit-label">LIVE<br/>SIGNAL</div></div>
      </section>

      <section className="dashboard" aria-label="Live stock feed">
        <div className="price-card panel">
          <div className="card-head"><div><span className="label">SIMULATED ASSET</span><div className="asset-name"><span className="ticker-icon">P</span><strong>Pulse Index</strong><span className="symbol">POC</span></div></div><span className="live-pill"><i /> LIVE</span></div>
          <div className="price-row"><div className="price">{money.format(price)}</div><div className={`change ${positive ? 'up' : 'down'}`}>{positive ? <ArrowUpRight size={17}/> : <ArrowDownRight size={17}/>} {positive ? '+' : ''}{change.toFixed(2)}%</div></div>
          <div className="chart-wrap"><div className="chart-grid"><span>$184</span><span>$183</span><span>$182</span><span>$181</span></div><svg className="chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Recent simulated prices"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b8fb69" stopOpacity=".2"/><stop offset="100%" stopColor="#b8fb69" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${chart} 100,100`} fill="url(#fill)"/><polyline points={chart} fill="none" stroke="#b8fb69" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/></svg><div className="chart-times"><span>NOW − 8s</span><span>LIVE</span></div></div>
          <div className="card-foot"><span><span className="pulse-dot"/> Updates every second</span><span>Simulated data</span></div>
        </div>

        <div className="side-column">
          <div className="devices-card panel"><div className="card-head"><span className="label">CONNECTED DEVICES</span><span className="device-icon"><Radio size={17}/></span></div><div className="device-count">{devices.toString().padStart(2, '0')}</div><div className="device-caption"><span className="status-dot"/>{devices === 1 ? '1 device receiving updates' : `${devices} devices receiving updates`}</div><div className="device-foot"><span>ACTIVE CONNECTIONS</span><span>{connected ? 'CONNECTED' : 'WAITING'}</span></div></div>
          <div className="connection-card panel"><div className="connection-icon">{connected ? <Wifi size={18}/> : <WifiOff size={18}/>}</div><div><span className="label">YOUR CONNECTION</span><strong>{connected ? 'You’re on the feed' : 'Joining the feed…'}</strong></div><span className={`connection-indicator ${connected ? 'on' : ''}`} /></div>
        </div>
      </section>

      <section className="chat panel" aria-label="WebSocket messages">
        <div className="chat-heading"><div><span className="label">TWO-WAY MESSAGES</span><p>Send a message over this live WebSocket connection.</p></div></div>
        <form className="chat-form" onSubmit={sendMessage}>
          <input aria-label="Message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" maxLength={500} disabled={!connected} />
          <button type="submit" disabled={!connected || !message.trim()}>Send</button>
        </form>
        {messageAck && <div className="chat-ack" role="status">✓ {messageAck}</div>}
        <div className="chat-list" aria-live="polite">{chat.length ? chat.slice().reverse().map((item) => <div className="chat-item" key={item.id}><span>{item.message}</span><time>{new Date(item.timestamp).toLocaleTimeString()}</time></div>) : <span className="chat-empty">Messages sent from any connected client appear here.</span>}</div>
      </section>

      <section className="tape panel"><div className="tape-title"><span className="label">LIVE TAPE</span><span className="tape-caption">Latest broadcasts</span></div><div className="tape-list">{ticks.length ? ticks.slice(0, 4).map((tick) => <div className="tape-item" key={tick.id}><span className="tape-symbol">POC/USD</span><strong>{money.format(tick.price)}</strong><span className={tick.change >= 0 ? 'tape-up' : 'tape-down'}>{tick.change >= 0 ? '+' : ''}{tick.change.toFixed(2)}%</span><time>{new Date(tick.timestamp).toLocaleTimeString()}</time></div>) : <div className="empty-tape">Waiting for the first price update<span className="typing"><i/><i/><i/></span></div>}</div><div className="tape-icon"><Activity size={19}/></div></section>

      <footer><span><span className="footer-mark">P</span> PULSE <span className="footer-sep">/</span> WEBSOCKET POC</span><span>ONE STREAM. EVERY DEVICE.</span><span><span className="footer-led"/> SYSTEM OPERATIONAL</span></footer>
    </main>
  );
}
