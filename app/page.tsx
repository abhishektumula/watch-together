import { HomeForms } from '@/components/HomeForms';
import { Icon } from '@/components/Icon';

export default function HomePage() {
  return (
    <main className="home">
      <div className="home-inner">
        <header className="home-head">
          <span className="brand">
            <span className="brand-mark">
              <Icon name="logo" size={18} />
            </span>
            Watch Together
          </span>
          <h1>Watch movies together, face to face.</h1>
          <p className="lead">A private room for two. Share your screen and keep both of you in view.</p>
        </header>
        <HomeForms />
      </div>
      <footer className="home-foot">Peer-to-peer video · Nothing is recorded · Best in desktop Chrome or Edge</footer>
    </main>
  );
}
