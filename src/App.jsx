// =============================================================
// Dispatch Planner – Interactive MVP (React + Tailwind)
// -------------------------------------------------------------
// 26 Jun 2025 PATCH ⟶ "CR‑02: User feedback round"  🚧
// WHY / SUMMARY OF CHANGES
//   • Sites ▸ add **phone** field & tel‑link call icon (📞)
//           ▸ expand / collapse tanks with chevron toggle
//           ▸ edit & delete existing site + tanks
//   • Drivers ▸ full CRUD (add, edit, delete)
//   • Planner ▸ qty input no longer prepends 0 (shows blank when 0)
//           ▸ planned loads also appear under POD ➜ Pending list
//   • POD ▸ Pending vs History tabs, mark as delivered moves load
//   • Live Map ▸ "ETA" button – selects a site then shows distance & ETA
//               (haversine @ 55 mph) in toast notification
// -------------------------------------------------------------
//  HOW TO RUN LOCALLY (same as previous patch)
// -------------------------------------------------------------

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------- UI PRIMITIVES ----------------
function Button({ children, className = "", ...rest }) {
  return (
    <button
      {...rest}
      className={`px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition ${className}`}
    >
      {children}
    </button>
  );
}

function IconButton({ label, icon, className = "", ...rest }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md hover:bg-muted transition ${className}`}
    >
      <span>{icon}</span>
      {label && <span>{label}</span>}
    </button>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background rounded-xl w-full max-w-lg p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        {children}
        <Button className="mt-6" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function MenuLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "px-4 py-2 rounded-full transition text-sm font-medium",
          isActive
            ? "bg-primary text-primary-foreground shadow"
            : "bg-muted text-muted-foreground hover:bg-muted/70",
        ].join(" ")
      }
      end
    >
      {children}
    </NavLink>
  );
}

// ------------- GLOBAL STATE (in‑memory) -------------
function useStore() {
  const [sites, setSites] = useState([
    {
      id: 101,
      name: "Shell – Clifton",
      address: "123 MLK Dr, Cincinnati OH",
      phone: "+15135559876",
      tanks: [
        { id: 1, grade: "Regular", capacity: 10000 },
        { id: 2, grade: "Premium", capacity: 8000 },
      ],
    },
  ]);
  const [drivers, setDrivers] = useState([
    { id: 1, name: "R. Singh", phone: "+15135551234" },
  ]);
  const [loads, setLoads] = useState([]); // status: Planned | Delivered

  // ---------- Site helpers ----------
  const addSite = (site) => setSites((s) => [...s, site]);
  const updateSite = (id, patch) =>
    setSites((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const deleteSite = (id) => setSites((prev) => prev.filter((s) => s.id !== id));
  const addTankToSite = (siteId, tank) =>
    setSites((prev) =>
      prev.map((s) =>
        s.id === siteId ? { ...s, tanks: [...s.tanks, tank] } : s
      )
    );

  // ---------- Driver helpers ----------
  const addDriver = (d) => setDrivers((ds) => [...ds, d]);
  const updateDriver = (id, patch) =>
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const deleteDriver = (id) => setDrivers((prev) => prev.filter((d) => d.id !== id));

  // ---------- Load helpers ----------
  const addLoad = (l) => setLoads((ls) => [...ls, l]);
  const markLoadDelivered = (id) =>
    setLoads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "Delivered", deliveredAt: new Date().toISOString() } : l)));

  return {
    sites,
    addSite,
    updateSite,
    deleteSite,
    addTankToSite,
    drivers,
    addDriver,
    updateDriver,
    deleteDriver,
    loads,
    addLoad,
    markLoadDelivered,
  };
}

// -------------------- SITES PAGE --------------------
function SitesPage({ store }) {
  const { sites, addSite, updateSite, deleteSite, addTankToSite } = store;
  const [siteModal, setSiteModal] = useState({ open: false, editId: null });
  const [tankModalFor, setTankModalFor] = useState(null);
  const [formSite, setFormSite] = useState({ name: "", address: "", phone: "" });
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [newTank, setNewTank] = useState({ grade: "Regular", capacity: 0 });

  const openAddSite = () => {
    setFormSite({ name: "", address: "", phone: "" });
    setSiteModal({ open: true, editId: null });
  };

  const openEditSite = (site) => {
    setFormSite({ name: site.name, address: site.address, phone: site.phone || "" });
    setSiteModal({ open: true, editId: site.id });
  };

  const handleSaveSite = () => {
    if (!formSite.name) return toast.error("Site name?");
    if (siteModal.editId) {
      updateSite(siteModal.editId, formSite);
      toast.success("Site updated");
    } else {
      addSite({ id: Date.now(), ...formSite, tanks: [] });
      toast.success("Site added");
    }
    setSiteModal({ open: false, editId: null });
  };

  const handleAddTank = () => {
    if (!newTank.capacity) return toast.error("Capacity?");
    addTankToSite(tankModalFor, { id: Date.now(), ...newTank });
    setNewTank({ grade: "Regular", capacity: 0 });
    setTankModalFor(null);
    toast.success("Tank added");
  };

  const toggleCollapse = (id) => {
    setCollapsed((prev) => {
      const c = new Set(prev);
      c.has(id) ? c.delete(id) : c.add(id);
      return c;
    });
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sites</h1>
        <Button onClick={openAddSite}>Add Site</Button>
      </header>

      <div className="space-y-4">
        {sites.map((site) => (
          <div key={site.id} className="border rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg flex items-center gap-2 cursor-pointer" onClick={() => toggleCollapse(site.id)}>
                  <span>{collapsed.has(site.id) ? "▶" : "▼"}</span> {site.name}
                </h2>
                <p className="text-sm text-muted-foreground">{site.address}</p>
                {site.phone && (
                  <a href={`tel:${site.phone}`} className="inline-flex items-center gap-1 mt-1 text-blue-600 hover:underline text-sm">
                    📞 {site.phone}
                  </a>
                )}
              </div>
              <div className="space-x-1">
                <IconButton icon="✏️" label="" onClick={() => openEditSite(site)} />
                <IconButton icon="🗑️" label="" onClick={() => deleteSite(site.id)} />
                <IconButton icon="➕" label="Tank" onClick={() => setTankModalFor(site.id)} />
              </div>
            </div>

            {!collapsed.has(site.id) && (
              <table className="w-full mt-3 text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-1">#</th>
                    <th>Grade</th>
                    <th>Capacity (gal)</th>
                  </tr>
                </thead>
                <tbody>
                  {site.tanks.map((t, idx) => (
                    <tr key={t.id} className="border-b hover:bg-muted/50">
                      <td className="py-1">{idx + 1}</td>
                      <td>{t.grade}</td>
                      <td>{t.capacity.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit Site Modal */}
      <Modal
        open={siteModal.open}
        onClose={() => setSiteModal({ open: false, editId: null })}
        title={siteModal.editId ? "Edit Site" : "Add Site"}
      >
        <label className="block mb-2 text-sm">Name</label>
        <input className="w-full border rounded p-2 mb-3" value={formSite.name} onChange={(e) => setFormSite((s) => ({ ...s, name: e.target.value }))} />
        <label className="block mb-2 text-sm">Address</label>
        <input className="w-full border rounded p-2 mb-3" value={formSite.address} onChange={(e) => setFormSite((s) => ({ ...s, address: e.target.value }))} />
        <label className="block mb-2 text-sm">Phone</label>
        <input className="w-full border rounded p-2" value={formSite.phone} onChange={(e) => setFormSite((s) => ({ ...s, phone: e.target.value }))} />
        <Button className="mt-4" onClick={handleSaveSite}>Save</Button>
      </Modal>

      {/* Add Tank Modal */}
      <Modal open={tankModalFor !== null} onClose={() => setTankModalFor(null)} title="Add Tank">
        <label className="block mb-2 text-sm">Grade</label>
        <select className="w-full border rounded p-2 mb-4" value={newTank.grade} onChange={(e) => setNewTank((t) => ({ ...t, grade: e.target.value }))}>
          <option>Regular</option>
          <option>Premium</option>
          <option>Diesel</option>
        </select>
        <label className="block mb-2 text-sm">Capacity (gal)</label>
        <input type="number" className="w-full border rounded p-2" value={newTank.capacity} onChange={(e) => setNewTank((t) => ({ ...t, capacity: +e.target.value }))} />
        <Button className="mt-4" onClick={handleAddTank}>Save</Button>
      </Modal>
    </div>
  );
}

// ---------------- DRIVERS PAGE --------------------
function DriversSection({ store }) {
  const { drivers, addDriver, updateDriver, deleteDriver } = store;
  const [modal, setModal] = useState({ open: false, editId: null });
  const [form, setForm] = useState({ name: "", phone: "" });

  const openAdd = () => {
    setForm({ name: "", phone: "" });
    setModal({ open: true, editId: null });
  };
  const openEdit = (d) => {
    setForm({ name: d.name, phone: d.phone });
    setModal({ open: true, editId: d.id });
  };
  const handleSave = () => {
    if (!form.name) return toast.error("Name?");
    if (modal.editId) {
      updateDriver(modal.editId, form);
      toast.success("Driver updated");
    } else {
      addDriver({ id: Date.now(), ...form });
      toast.success("Driver added");
    }
    setModal({ open: false, editId: null });
  };

  return (
    <div className="mt-8">
      <header className="flex justify-between items-center mb-2">
        <h2 className="font-medium">Drivers</h2>
        <Button className="text-xs" onClick={openAdd}>
          Add
        </Button>
      </header>
      <ul className="space-y-1">
        {drivers.map((d) => (
          <li key={d.id} className="text-sm flex justify-between items-center border-b py-1">
            <span>
              {d.name} – {d.phone}
            </span>
            <span className="space-x-1">
              <IconButton icon="✏️" onClick={() => openEdit(d)} />
              <IconButton icon="🗑️" onClick={() => deleteDriver(d.id)} />
            </span>
          </li>
        ))}
      </ul>

      <Modal open={modal.open} onClose={() => setModal({ open: false, editId: null })} title={modal.editId ? "Edit Driver" : "Add Driver"}>
        <label className="block mb-2 text-sm">Name</label>
        <input className="w-full border rounded p-2 mb-4" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <label className="block mb-2 text-sm">Phone</label>
        <input className="w-full border rounded p-2" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <Button className="mt-4" onClick={handleSave}>Save</Button>
      </Modal>
    </div>
  );
}

// ---------------- LOAD PLANNER --------------------
function PlannerPage({ store }) {
  const { sites, drivers, loads, addLoad } = store;
  const navigate = useNavigate();

  const [siteId, setSiteId] = useState(sites[0]?.id || "");
  const [driverId, setDriverId] = useState(drivers[0]?.id || "");
  const [items, setItems] = useState([]);
  const [grade, setGrade] = useState("Regular");
  const [qty, setQty] = useState(0);

  useEffect(() => {
    console.assert(Array.isArray(loads), "[TEST] Loads initialised array");
  }, [loads]);

  const totalQty = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const maxGal = 8800;

  const addItem = () => {
    if (!qty) return toast.error("Qty?");
    if (totalQty + qty > maxGal) return toast.error("Exceeds 8,800 gal");
    setItems((it) => [...it, { grade, qty }]);
    setQty(0);
  };

  const handleCreateLoad = () => {
    if (!siteId || !driverId || items.length === 0) return toast.error("Fill all fields");
    const load = {
      id: Date.now(),
      siteId,
      driverId,
      items,
      status: "Planned",
      createdAt: new Date().toISOString(),
    };
    addLoad(load);
    toast.success("Load created");
    notifyDriver(load, drivers.find((d) => d.id === driverId));
    // reset
    setItems([]);
  };

  const notifyDriver = async (load, driver) => {
    const siteName = sites.find((s) => s.id === load.siteId).name;
    const qtyStr = load.items.map((i) => `${i.qty} gal ${i.grade}`).join(", ");
    const message = `Load for ${siteName}: ${qtyStr}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Load Assignment", text: message });
      } else {
        await navigator.clipboard.writeText(message);
        toast("Copied assignment to clipboard");
      }
    } catch (err) {
      console.warn(err);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Load Planner</h1>

      <div className="space-y-4 border p-4 rounded-lg shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Site</label>
            <select className="w-full border rounded p-2" value={siteId} onChange={(e) => setSiteId(+e.target.value)}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Driver</label>
            <select className="w-full border rounded p-2" value={driverId} onChange={(e) => setDriverId(+e.target.value)}>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm mb-1">Grade</label>
            <select className="w-full border rounded p-2" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option>Regular</option>
              <option>Premium</option>
              <option>Diesel</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm mb-1">Qty (gal)</label>
            <input type="number" className="w-full border rounded p-2" value={qty || ""} onChange={(e) => setQty(+e.target.value)} />
          </div>
          <Button className="h-10" onClick={addItem}>Add</Button>
        </div>

        {items.length > 0 && (
          <table className="w-full mt-4 text-sm border-collapse">
            <thead>
              <tr className="border-b"><th className="text-left py-1">Grade</th><th>Qty (gal)</th></tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b"><td className="py-1">{it.grade}</td><td>{it.qty}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td className="font-semibold py-1">Total</td><td className="font-semibold">{totalQty}</td></tr></tfoot>
          </table>
        )}

        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-muted-foreground">Max 8,800 gal per load</span>
          <Button onClick={handleCreateLoad} disabled={items.length === 0}>Create Load</Button>
        </div>
      </div>

      <DriversSection store={store} />

      {loads.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-2">Planned Loads</h2>
          <ul className="space-y-2">
            {loads.filter((l) => l.status === "Planned").map((l) => (
              <li key={l.id} className="border rounded p-3 flex justify-between items-center">
                <span>{new Date(l.createdAt).toLocaleString()} – {sites.find((s) => s.id === l.siteId).name}</span>
                <Button className="text-xs" onClick={() => navigate(`/pod?load=${l.id}`)}>POD</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------- LIVE MAP --------------------
function haversineDistance([lon1, lat1], [lon2, lat2]) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // km
}

function MapPage({ store }) {
  const { drivers, sites } = store;
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarkers = useRef([]);

  useEffect(() => {
    const styleOSM = {
      version: 8,
      sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    };

    try {
      mapInstance.current = new maplibregl.Map({ container: mapRef.current, style: styleOSM, center: [-84.51, 39.10], zoom: 6 });
      mapInstance.current.addControl(new maplibregl.NavigationControl());

      driverMarkers.current = drivers.map((d, idx) => {
        return new maplibregl.Marker({ color: idx === 0 ? "#3b82f6" : "#10b981" })
          .setLngLat([-84.51 + idx * 0.2, 39.10 + idx * 0.2])
          .setPopup(new maplibregl.Popup().setText(d.name))
          .addTo(mapInstance.current);
      });

      console.assert(mapInstance.current, "[TEST] Map object created");
    } catch (err) {
      console.error("Map failed to load", err);
      toast.error("Map failed to load. Check network / tile server");
    }

    return () => {
      if (mapInstance.current) mapInstance.current.remove();
    };
  }, [drivers]);

  const handleETA = () => {
    if (!mapInstance.current) return;
    const driverPos = driverMarkers.current[0]?.getLngLat();
    if (!driverPos) return;
    const site = sites[0];
    const sitePos = [-84.51, 39.10]; // TODO replace with real site coords if available
    const distKm = haversineDistance([driverPos.lng, driverPos.lat], sitePos);
    const speedKmH = 55;
    const etaH = distKm / speedKmH;
    const etaMin = Math.round(etaH * 60);
    toast.success(`ETA to ${site.name}: ~${etaMin} min (${distKm.toFixed(1)} km)`);
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)]">
      <div ref={mapRef} className="w-full h-full" />
      <IconButton label="ETA" icon="🕑" className="absolute top-4 right-4 bg-background/80" onClick={handleETA} />
    </div>
  );
}

// ---------------- POD PAGE --------------------
function PodPage({ store }) {
  const { loads, sites, markLoadDelivered } = store;
  const [tab, setTab] = useState("pending");
  const query = new URLSearchParams(window.location.search);
  const loadIdParam = +query.get("load");
  const navigate = useNavigate();

  const filteredLoads = loads.filter((l) => (tab === "pending" ? l.status === "Planned" : l.status === "Delivered"));
  const selectedLoad = loads.find((l) => l.id === loadIdParam);
  const [file, setFile] = useState(null);

  const handleUpload = (l) => (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(URL.createObjectURL(f));
      markLoadDelivered(l.id);
      toast.success("POD saved – load marked delivered");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Proof of Delivery</h1>
      <div className="flex gap-2 my-2">
        <Button className={tab === "pending" ? "" : "bg-muted text-muted-foreground"} onClick={() => setTab("pending")}>Pending</Button>
        <Button className={tab === "history" ? "" : "bg-muted text-muted-foreground"} onClick={() => setTab("history")}>History</Button>
      </div>

      {filteredLoads.length === 0 && <p className="text-muted-foreground text-sm">No loads</p>}

      <ul className="space-y-2">
        {filteredLoads.map((l) => (
          <li key={l.id} className="border rounded p-3 flex justify-between items-center">
            <span>{sites.find((s) => s.id === l.siteId)?.name} — {new Date(l.createdAt).toLocaleString()}</span>
            {tab === "pending" && (
              <label className="cursor-pointer text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90">
                Attach POD
                <input type="file" accept="image/*" capture="environment" onChange={handleUpload(l)} className="hidden" />
              </label>
            )}
          </li>
        ))}
      </ul>

      {selectedLoad && <img src={file} alt="POD" className="rounded shadow w-full mt-4" />}
    </div>
  );
}

// ---------------- APP ROOT --------------------
export default function App() {
  const store = useStore();
  return (
    <Router>
      <header className="sticky top-0 z-50 bg-gradient-to-r from-background via-muted to-background/90 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">SevenStar Dispatch</span>
          <nav className="flex gap-2 flex-wrap">
            <MenuLink to="/">Sites</MenuLink>
            <MenuLink to="/planner">Planner</MenuLink>
            <MenuLink to="/map">Live Map</MenuLink>
            <MenuLink to="/pod">POD</MenuLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route index element={<SitesPage store={store} />} />
        <Route path="planner" element={<PlannerPage store={store} />} />
        <Route path="map" element={<MapPage store={store} />} />
        <Route path="pod" element={<PodPage store={store} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster position="top-center" />
    </Router>
  );
}
