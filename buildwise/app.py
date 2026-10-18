import streamlit as st
import textwrap

# ============================================================
# PAGE CONFIG
# ============================================================

def html(content):
    st.markdown(
        textwrap.dedent(content),
        unsafe_allow_html=True
    )

st.set_page_config(
    page_title="BuildWise",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# CUSTOM CSS
# ============================================================

st.markdown("""
<style>

    /* ---------- GLOBAL ---------- */

    .stApp {
        background: #f7f8fa;
    }

    #MainMenu {
        visibility: hidden;
    }

    footer {
        visibility: hidden;
    }

    header {
        background: transparent !important;
    }

    .block-container {
        padding-top: 2rem;
        padding-bottom: 3rem;
        max-width: 1400px;
    }


    /* ---------- SIDEBAR ---------- */

    [data-testid="stSidebar"] {
        background: #111827;
        border-right: 1px solid #1f2937;
    }

    [data-testid="stSidebar"] > div {
        padding-top: 2rem;
    }

    .brand {
        padding: 0 1rem 2rem 1rem;
    }

    .brand-name {
        color: white;
        font-size: 25px;
        font-weight: 700;
    }

    .brand-tagline {
        color: #9ca3af;
        font-size: 12px;
        margin-top: 4px;
    }

    .sidebar-label {
        color: #6b7280;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1px;
        margin: 15px 16px 8px 16px;
    }


    /* ---------- TYPOGRAPHY ---------- */

    .page-title {
        font-size: 34px;
        font-weight: 750;
        color: #111827;
        margin-bottom: 4px;
    }

    .page-subtitle {
        color: #6b7280;
        font-size: 15px;
        margin-bottom: 28px;
    }

    .section-title {
        font-size: 20px;
        font-weight: 700;
        color: #111827;
        margin-top: 30px;
        margin-bottom: 14px;
    }


    /* ---------- CARDS ---------- */

    .card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 22px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    }

    .stat-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 20px;
        min-height: 130px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    }

    .stat-label {
        color: #6b7280;
        font-size: 13px;
        margin-bottom: 10px;
    }

    .stat-value {
        color: #111827;
        font-size: 27px;
        font-weight: 750;
    }

    .stat-unit {
        color: #9ca3af;
        font-size: 12px;
        margin-top: 5px;
    }


    /* ---------- PROJECT CARD ---------- */

    .project-card {
        background: #111827;
        border-radius: 18px;
        padding: 25px;
        color: white;
        margin-top: 5px;
    }

    .project-name {
        font-size: 23px;
        font-weight: 700;
    }

    .project-location {
        color: #9ca3af;
        margin-top: 5px;
        font-size: 13px;
    }

    .status-badge {
        display: inline-block;
        background: #dcfce7;
        color: #166534;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
    }


    /* ---------- PROGRESS ---------- */

    .progress-label {
        display: flex;
        justify-content: space-between;
        color: #6b7280;
        font-size: 12px;
        margin-top: 7px;
    }


    /* ---------- BUTTONS ---------- */

    .stButton > button {
        border-radius: 10px;
        font-weight: 600;
        min-height: 42px;
    }


    /* ---------- DIVIDER ---------- */

    .divider {
        height: 1px;
        background: #e5e7eb;
        margin: 25px 0;
    }

</style>
""", unsafe_allow_html=True)


# ============================================================
# SIDEBAR
# ============================================================

with st.sidebar:

    st.markdown("""
        <div class="brand">
            <div class="brand-name">🏠 BuildWise</div>
            <div class="brand-tagline">Plan smarter. Build better.</div>
        </div>
    """, unsafe_allow_html=True)

    st.markdown(
        '<div class="sidebar-label">MAIN MENU</div>',
        unsafe_allow_html=True
    )

    page = st.radio(
        "Navigation",
        [
            "Dashboard",
            "House Planner",
            "Cost Estimation",
            "Construction",
            "Materials",
            "Reports",
        ],
        label_visibility="collapsed",
    )

    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown("""
        <div style="
            background:#1f2937;
            padding:16px;
            border-radius:14px;
            margin:0 8px;
        ">
            <div style="
                color:#6b7280;
                font-size:10px;
                font-weight:700;
                letter-spacing:1px;
            ">
                CURRENT PROJECT
            </div>

            <div style="
                color:white;
                font-size:15px;
                font-weight:600;
                margin-top:7px;
            ">
                My Dream Home
            </div>

            <div style="
                color:#9ca3af;
                font-size:12px;
                margin-top:4px;
            ">
                📍 Tamil Nadu
            </div>
        </div>
    """, unsafe_allow_html=True)


# ============================================================
# DASHBOARD
# ============================================================

if page == "Dashboard":

    st.markdown(
        '<div class="page-title">Good afternoon 👋</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-subtitle">'
        'Let\'s plan your dream home.'
        '</div>',
        unsafe_allow_html=True
    )

    # --------------------------------------------------------
    # PROJECT HEADER
    # --------------------------------------------------------

    st.markdown("""
        <div class="project-card">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
            ">

                <div>
                    <div class="project-name">
                        My Dream Home
                    </div>

                    <div class="project-location">
                        📍 Tamil Nadu &nbsp; • &nbsp; 3 Bedrooms
                        &nbsp; • &nbsp; 2 Floors
                    </div>
                </div>

                <div class="status-badge">
                    Planning
                </div>

            </div>

        </div>
    """, unsafe_allow_html=True)

    # --------------------------------------------------------
    # STATS
    # --------------------------------------------------------

    st.markdown(
        '<div class="section-title">Project Overview</div>',
        unsafe_allow_html=True
    )

    col1, col2, col3, col4 = st.columns(4)

    stats = [
        ("📐", "Plot Area", "2,400", "sq.ft"),
        ("🏠", "Built-up Area", "1,850", "sq.ft"),
        ("💰", "Estimated Cost", "₹32.5L", "within budget"),
        ("⏱️", "Duration", "10", "months"),
    ]

    for col, (icon, label, value, unit) in zip(
        [col1, col2, col3, col4],
        stats
    ):
        with col:
            st.markdown(
                f"""
                <div class="stat-card">
                    <div class="stat-label">
                        {icon} &nbsp; {label}
                    </div>

                    <div class="stat-value">
                        {value}
                    </div>

                    <div class="stat-unit">
                        {unit}
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )

    # --------------------------------------------------------
    # CONSTRUCTION PROGRESS
    # --------------------------------------------------------

    st.markdown(
        '<div class="section-title">Construction Progress</div>',
        unsafe_allow_html=True
    )

    progress = 18

    st.markdown(
        f"""
        <div class="card">

            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:12px;
            ">
                <div>
                    <b>Overall Progress</b>
                    <div style="
                        color:#6b7280;
                        font-size:12px;
                        margin-top:3px;
                    ">
                        Current project completion
                    </div>
                </div>

                <div style="
                    font-size:24px;
                    font-weight:700;
                    color:#111827;
                ">
                    {progress}%
                </div>
            </div>

        </div>
        """,
        unsafe_allow_html=True
    )

    st.progress(progress / 100)

    st.markdown("""
        <div class="progress-label">
            <span>Planning</span>
            <span>Foundation</span>
            <span>Structure</span>
            <span>Finishing</span>
            <span>Completed</span>
        </div>
    """, unsafe_allow_html=True)

    # --------------------------------------------------------
    # BOTTOM SECTION
    # --------------------------------------------------------

    left, right = st.columns(2)

    with left:

        st.markdown(
            '<div class="section-title">Budget Summary</div>',
            unsafe_allow_html=True
        )

        st.markdown("""
            <div class="card">

                <div style="
                    display:flex;
                    justify-content:space-between;
                    margin-bottom:14px;
                ">
                    <span style="color:#6b7280;">
                        Total Budget
                    </span>

                    <b>₹35.0L</b>
                </div>

                <div style="
                    display:flex;
                    justify-content:space-between;
                    margin-bottom:14px;
                ">
                    <span style="color:#6b7280;">
                        Estimated Cost
                    </span>

                    <b>₹32.5L</b>
                </div>

                <div style="
                    height:1px;
                    background:#e5e7eb;
                    margin:10px 0 14px 0;
                "></div>

                <div style="
                    display:flex;
                    justify-content:space-between;
                ">
                    <span style="color:#166534;">
                        Remaining Budget
                    </span>

                    <b style="color:#166534;">
                        ₹2.5L
                    </b>
                </div>

            </div>
        """, unsafe_allow_html=True)

    with right:

        st.markdown(
            '<div class="section-title">Quick Actions</div>',
            unsafe_allow_html=True
        )

        st.markdown("""
            <div class="card">

                <div style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    padding:8px 0;
                ">
                    <span style="font-size:22px;">📐</span>
                    <div>
                        <b>House Planner</b>
                        <div style="
                            color:#6b7280;
                            font-size:12px;
                        ">
                            Create your house plan
                        </div>
                    </div>
                </div>

                <div style="
                    height:1px;
                    background:#f0f0f0;
                    margin:8px 0;
                "></div>

                <div style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    padding:8px 0;
                ">
                    <span style="font-size:22px;">💰</span>
                    <div>
                        <b>Cost Estimator</b>
                        <div style="
                            color:#6b7280;
                            font-size:12px;
                        ">
                            Estimate construction expenses
                        </div>
                    </div>
                </div>

                <div style="
                    height:1px;
                    background:#f0f0f0;
                    margin:8px 0;
                "></div>

                <div style="
                    display:flex;
                    align-items:center;
                    gap:12px;
                    padding:8px 0;
                ">
                    <span style="font-size:22px;">🧱</span>
                    <div>
                        <b>Material Estimate</b>
                        <div style="
                            color:#6b7280;
                            font-size:12px;
                        ">
                            Calculate required materials
                        </div>
                    </div>
                </div>

            </div>
        """, unsafe_allow_html=True)