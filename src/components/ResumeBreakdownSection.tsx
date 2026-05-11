import React from 'react';
import { 
    Network, Database, Cpu, BrainCircuit, Code, Braces, 
    FileSignature, Presentation, ActivitySquare, TerminalSquare, 
    HeartHandshake, Building2, Microscope, Layers, Lightbulb, GraduationCap
} from 'lucide-react';

export const ResumeBreakdownSection: React.FC = React.memo(() => {
    const nextSlide = () => (window as any).fullpage_api?.moveSlideRight();
    const prevSlide = () => (window as any).fullpage_api?.moveSlideLeft();

    return (
        <div className="section transparent-section relative">
            <button onClick={prevSlide} className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 z-50 pointer-events-auto rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-cyan-500/20 shadow-[0_0_20px_rgba(0,255,255,0.7)] border border-cyan-300 text-cyan-200 transition-transform active:scale-90 hover:scale-110">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={nextSlide} className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 z-50 pointer-events-auto rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-fuchsia-500/20 shadow-[0_0_20px_rgba(255,0,255,0.7)] border border-fuchsia-300 text-fuchsia-200 transition-transform active:scale-90 hover:scale-110">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Slide 0: Identity & Profile */}
            <div className="slide px-4 md:px-8">
                <div className="flex flex-col min-h-screen justify-center items-center select-none max-w-5xl mx-auto w-full overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-6 drop-shadow-[0_0_15px_rgba(0,255,255,0.8)] pointer-events-auto text-center">
                        CM SISK (CDA SCIENTIST)
                    </h2>
                    
                    <div className="p-6 md:p-10 backdrop-blur-xl bg-black/50 border border-fuchsia-500/30 rounded-3xl w-full pointer-events-auto shadow-[0_0_30px_rgba(255,0,255,0.15)] flex flex-col md:flex-row gap-8 items-center text-left">
                        <div className="w-full md:w-1/3 flex flex-col items-center border-r border-fuchsia-500/20 pr-0 md:pr-8">
                            <BrainCircuit className="w-20 h-20 text-fuchsia-400 mb-4 animate-pulse" />
                            <h3 className="text-xl md:text-xl md:text-2xl font-bold text-white mb-2 text-center">Machine Learning Engineer</h3>
                            <p className="text-cyan-400 font-mono text-center">Denver, CO | Remote</p>
                            <p className="text-gray-400 text-sm mt-2 text-center">cdascientist@outlook.com</p>
                        </div>
                        <div className="w-full md:w-2/3">
                            <h4 className="text-cyan-300 border-b border-cyan-500/30 pb-2 mb-4 font-mono text-lg uppercase tracking-wider">Profile Summary</h4>
                            <p className="text-xs md:text-sm text-gray-300 font-mono leading-relaxed mb-4">
                                Aspiring Machine Learning Engineer with a passion for developing innovative algorithms and optimizing complex data structures. Seeking to leverage strong analytical skills and a deep understanding of distributed systems to contribute to cutting-edge advancements in high-dimensional data processing.
                            </p>
                            <p className="text-xs md:text-sm text-gray-300 font-mono leading-relaxed">
                                My <strong>N Dimensional Cluster Execution</strong> algorithm introduces a highly innovative vertex-based computational model within an n-dimensional matrix, where each vertex acts as an autonomous node performing local normalization and density calculations, enabling efficient distributed clustering and eliminating centralized processing bottlenecks. It creatively adapts traditional K-means clustering into a distributed framework, further enhancing analysis through dimensional lifting into an (n+1)-dimensional simplex structure.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide 1: Skills & Stack */}
            <div className="slide px-4 md:px-8">
               <div className="flex flex-col min-h-screen justify-center items-center select-none max-w-5xl mx-auto w-full overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl text-cyan-400 mb-6 font-mono drop-shadow-[0_0_15px_#0ff] pointer-events-auto text-center uppercase tracking-widest">
                        Technical Arsenal
                    </h2>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 w-full pointer-events-auto">
                        <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] hover:scale-105 transition-transform">
                            <ActivitySquare className="w-10 h-10 text-cyan-400 mb-4" />
                            <h3 className="text-base font-bold text-white mb-4 border-b border-white/10 pb-2">AI / ML Core</h3>
                            <ul className="text-gray-400 font-mono text-xs md:text-sm space-y-2">
                                <li className="flex justify-between"><span>Tensorflow</span><span className="text-cyan-500">95%</span></li>
                                <li className="flex justify-between"><span>PyTorch</span><span className="text-cyan-500">90%</span></li>
                                <li className="flex justify-between"><span>LangChain/N8N</span><span className="text-cyan-500">85%</span></li>
                                <li className="flex justify-between"><span>MoE / Activation</span><span className="text-cyan-500">98%</span></li>
                            </ul>
                        </div>
                        
                        <div className="backdrop-blur-xl bg-black/40 border border-fuchsia-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(255,0,255,0.1)] hover:scale-105 transition-transform">
                            <Database className="w-10 h-10 text-fuchsia-400 mb-4" />
                            <h3 className="text-base font-bold text-white mb-4 border-b border-white/10 pb-2">Data & Cloud</h3>
                            <ul className="text-gray-400 font-mono text-xs md:text-sm space-y-2">
                                <li className="flex justify-between"><span>Databricks/Snowflake</span><span className="text-fuchsia-500">92%</span></li>
                                <li className="flex justify-between"><span>Hadoop/Airflow</span><span className="text-fuchsia-500">88%</span></li>
                                <li className="flex justify-between"><span>Terraform</span><span className="text-fuchsia-500">90%</span></li>
                                <li className="flex justify-between"><span>AWS EC2/Lambda</span><span className="text-fuchsia-500">95%</span></li>
                            </ul>
                        </div>

                        <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] hover:scale-105 transition-transform">
                            <Cpu className="w-10 h-10 text-cyan-400 mb-4" />
                            <h3 className="text-base font-bold text-white mb-4 border-b border-white/10 pb-2">Systems & Arch</h3>
                            <ul className="text-gray-400 font-mono text-xs md:text-sm space-y-2">
                                <li className="flex justify-between"><span>eBPF</span><span className="text-cyan-500">95%</span></li>
                                <li className="flex justify-between"><span>CUDA / NCCL</span><span className="text-cyan-500">80%</span></li>
                                <li className="flex justify-between"><span>Docker / K8s</span><span className="text-cyan-500">90%</span></li>
                                <li className="flex justify-between"><span>JIT Architecture</span><span className="text-cyan-500">92%</span></li>
                            </ul>
                        </div>

                        <div className="backdrop-blur-xl bg-black/40 border border-fuchsia-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(255,0,255,0.1)] hover:scale-105 transition-transform">
                            <Code className="w-10 h-10 text-fuchsia-400 mb-4" />
                            <h3 className="text-base font-bold text-white mb-4 border-b border-white/10 pb-2">Languages</h3>
                            <ul className="text-gray-400 font-mono text-xs md:text-sm space-y-2">
                                <li className="flex justify-between"><span>Python</span><span className="text-fuchsia-500">98%</span></li>
                                <li className="flex justify-between"><span>C# / C++ / C</span><span className="text-fuchsia-500">90%</span></li>
                                <li className="flex justify-between"><span>Node.js / React</span><span className="text-fuchsia-500">85%</span></li>
                                <li className="flex justify-between"><span>Java / Swift</span><span className="text-fuchsia-500">80%</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide 2: Exhaustive Skills Matrix */}
            <div className="slide px-4 md:px-8 relative h-full">
                <div className="flex flex-col min-h-screen items-center select-none max-w-5xl mx-auto w-full overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl text-blue-400 mb-6 font-mono drop-shadow-[0_0_15px_rgba(59,130,246,0.8)] pointer-events-auto text-center sticky top-0 bg-black/50 py-4 backdrop-blur-md z-10 w-full uppercase">
                        EXHAUSTIVE SKILLS MATRIX
                    </h2>
                    
                    <div className="flex flex-wrap gap-2 md:gap-3 w-full pointer-events-auto pb-10 justify-center max-w-4xl">
                        {[
                            'Ebpf', 'Tensorflow', 'Terraform', 'C#', 'Tableau/Salesforce Ai', 
                            'Mixture Of Experts/Activation Design', 'CUDA', 'NCCL', 'LangChain', 
                            'LangGraph', 'N8N', 'PyPy', 'PyTorch', 'JIT Architecture', 
                            'Convergence & Entropy', 'RMI', 'Docker', 'Kubernetes', 
                            'Databricks', 'Snowflake', 'Matlab', 'SPSS', 'Hadoop', 
                            'Airflow', 'Kernel Hex', 'Elf Hex', 'Splunk', 'Maven', 'AWS EC2', 
                            'AWS Lambda', 'Node.js', 'Custom AMI', 'TPL', 'CLI', 'CCI Metadata', 
                            'Jupyter', 'MS SQL', 'PostgreSQL', 'Selenium', 'Semantikernal', 
                            'Amazon S3', 'AWS RDS', 'React', 'Vue', 'BrightScript', 'Swift', 
                            'SOCs', 'Agentic Workflow', 'Agentic Mod', 'Colab', 'GCE', 
                            'Spring', 'LLM Fine Tuning', 'Referential Index Analysis', 
                            'KPI Development', 'DOMO', 'COE', 'GraphQL', 'ETL', 'DEET', 
                            'AB Experimentation', 'MQ', 'Firebird', 'Statistical Analysis', 
                            'Octa Tech Stack', 'Oracle oci', 'UAV Systems', 'C', 'C++', 
                            'JS', 'Python', 'Java', 'Git', 'Linux', 'Recursive Vertex design', 
                            'Isometrics', 'Transformer Design', 'Entropy Inversion', 
                            'Forward Pass propagation', 'SoftMax Inversion', 'Convergence Prevention', 
                            'Dissipation Sampling', 'Mckinsey Quantum Black', 'Aspire', 
                            'ETL Tools', 'Unity', 'Unreal Engine 5', 'Entity Framework'
                        ].map((skill, index) => (
                            <span 
                                key={index} 
                                className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-mono rounded-full border border-blue-500/30 bg-blue-900/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 transition-all cursor-default"
                            >
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Slide 3: Recent ML Trajectory */}
            <div className="slide px-4 md:px-8 relative h-full">
                <div className="flex flex-col min-h-screen items-center select-none max-w-5xl mx-auto w-full pointer-events-auto overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl text-cyan-300 mb-6 font-mono drop-shadow-[0_0_15px_rgba(0,255,255,0.6)] text-center sticky top-0 bg-black/50 py-4 backdrop-blur-md z-10 w-full">
                        RECENT ML TRAJECTORY
                    </h2>
                    
                    <div className="flex flex-col gap-6 w-full pb-10">
                        <div className="backdrop-blur-xl bg-black/60 border-l-4 border-cyan-500 p-6 rounded-r-2xl shadow-lg relative overflow-hidden group">
                            <Network className="absolute top-4 right-4 w-16 h-16 text-cyan-400/10 group-hover:text-cyan-400/30 transition-colors" />
                            <h3 className="text-xl md:text-2xl font-bold text-white pr-16">Principal ML Researcher/Consultant</h3>
                            <p className="text-cyan-400 font-mono mb-3 uppercase text-sm tracking-wider">CCA / Non-Profit • Q2 2024 - Q2 2025</p>
                            <ul className="text-gray-300 font-mono text-sm space-y-2 list-disc pl-5">
                                <li><strong>Novel ML Architecture:</strong> Architected a system to establish predeterminism in non-deterministic environments by recursively calculating compound high-dimensional ML embeddings.</li>
                                <li><strong>Geometric Feature Engineering:</strong> Pipeline transforming K-means into 3D magnitude representations using Mandelbulb-inspired fractal diffusion.</li>
                                <li><strong>Curvature-Augmented Neural Networks:</strong> Engineered technique integrating principal curvatures as eigenvalues.</li>
                                <li><strong>Dynamic N-Dimensional Proliferation:</strong> Mechanism dynamically scaling feature space dimensionality.</li>
                            </ul>
                        </div>

                        <div className="backdrop-blur-xl bg-black/60 border-l-4 border-fuchsia-500 p-6 rounded-r-2xl shadow-lg relative overflow-hidden group">
                            <Braces className="absolute top-4 right-4 w-16 h-16 text-fuchsia-400/10 group-hover:text-fuchsia-400/30 transition-colors" />
                            <h3 className="text-xl md:text-2xl font-bold text-white pr-16">Principal ML Engineer II</h3>
                            <p className="text-fuchsia-400 font-mono mb-3 uppercase text-sm tracking-wider">RMTC • Q2 2022 - Q1 2024</p>
                            <ul className="text-gray-300 font-mono text-sm space-y-2 list-disc pl-5">
                                <li>Analytical Formulation Specialist: identified, formulated, and produced mathematical methods.</li>
                                <li>Designed middleware architecture conjunctions with legacy solutions and LLMs.</li>
                                <li>Method Correlation: Correlated mathematical methods with functional utility.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide 4: Systems & Analytical Roles */}
            <div className="slide px-4 md:px-8 relative h-full">
                <div className="flex flex-col min-h-screen items-center select-none max-w-5xl mx-auto w-full pointer-events-auto overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl text-yellow-300 mb-6 font-mono drop-shadow-[0_0_15px_rgba(255,255,0,0.6)] text-center sticky top-0 bg-black/50 py-4 backdrop-blur-md z-10 w-full">
                        SYSTEMS & ANALYTICAL ROLES
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full pb-10">
                        <div className="backdrop-blur-xl bg-black/50 border border-yellow-500/20 p-5 rounded-2xl">
                            <h4 className="text-xl font-bold text-white">Account Analyst</h4>
                            <p className="text-yellow-400 font-mono text-xs mb-2">Ecosphere Venture Capital | Q4 2019-Q2 2021</p>
                            <p className="text-gray-400 text-sm">Achieved 92% customer resolution rate utilizing Octa CRM ERP across international infrastructures. Maintained 91% International Customer retention.</p>
                        </div>

                        <div className="backdrop-blur-xl bg-black/50 border border-yellow-500/20 p-5 rounded-2xl">
                            <h4 className="text-xl font-bold text-white">Principal SQA Analyst</h4>
                            <p className="text-yellow-400 font-mono text-xs mb-2">Microsoft UD Labs | Q1 2019-Q4 2019</p>
                            <p className="text-gray-400 text-sm">Algorithmic analysis of dynamic variables across deployments. Stack: .NET, Jira, Unity. Comparative analytics between application versions.</p>
                        </div>

                        <div className="backdrop-blur-xl bg-black/50 border border-yellow-500/20 p-5 rounded-2xl">
                            <h4 className="text-xl font-bold text-white">Principal Systems Analyst</h4>
                            <p className="text-yellow-400 font-mono text-xs mb-2">Teakoe | Q2 2018-Q2 2019</p>
                            <p className="text-gray-400 text-sm">Designed comparative statistical analysis of cumulative vector-based indices. Cloud computational infrastructures and variable platform development.</p>
                        </div>

                        <div className="backdrop-blur-xl bg-black/50 border border-yellow-500/20 p-5 rounded-2xl">
                            <h4 className="text-xl font-bold text-white">Principal Deep Learning/AI</h4>
                            <p className="text-yellow-400 font-mono text-xs mb-2">DOD DHS STTR SBIR | Q1 2017-Q2 2018</p>
                            <p className="text-gray-400 text-sm">Prototyped and executed comparative analytics, database structural design, and iterative sequencing dynamics. Documented operational objects.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide 5: Software & Automation Engineering */}
            <div className="slide px-4 md:px-8 relative h-full">
                <div className="flex flex-col min-h-screen items-center select-none max-w-5xl mx-auto w-full pointer-events-auto overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl text-emerald-400 mb-6 font-mono drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] text-center sticky top-0 bg-black/50 py-4 backdrop-blur-md z-10 w-full uppercase">
                        SOFTWARE & AUTOMATION
                    </h2>
                    
                    <div className="flex flex-col gap-6 w-full pb-10">
                        <div className="backdrop-blur-xl bg-black/60 border-t-2 border-emerald-500/50 p-6 rounded-b-2xl shadow-lg relative">
                            <h3 className="text-xl md:text-2xl font-bold text-white">Senior Software Developer</h3>
                            <p className="text-emerald-400 font-mono mb-3 uppercase text-sm tracking-wider">Operational Responsibilities</p>
                            <p className="text-gray-300 font-mono text-sm">Formulation and architectural design of computational structures for modular systems. C#, WPF, CCI, TPL methodologies. Object Relational Mapping.</p>
                        </div>

                        <div className="backdrop-blur-xl bg-black/60 border-t-2 border-emerald-500/50 p-6 rounded-b-2xl shadow-lg relative">
                            <h3 className="text-xl md:text-2xl font-bold text-white">Senior Software Engineer II</h3>
                            <p className="text-emerald-400 font-mono mb-3 uppercase text-sm tracking-wider">WSP Parsons & Brinkerhoff | Q3 2016-Q2 2017</p>
                            <p className="text-gray-300 font-mono text-sm">Development of interactive application for City of Detroit. Full-Stack Development and Interface Engineering. Variable specification and compilation infrastructures.</p>
                        </div>
                        
                        <div className="backdrop-blur-xl bg-black/60 border-t-2 border-emerald-500/50 p-6 rounded-b-2xl shadow-lg relative">
                            <h3 className="text-xl md:text-2xl font-bold text-white">Principal Automation & ML Engineer III</h3>
                            <p className="text-emerald-400 font-mono mb-3 uppercase text-sm tracking-wider">Accenture & Public Think Tank | Q1 2016-Q4 2016</p>
                            <p className="text-gray-300 font-mono text-sm">Spearheaded methodology for inter-application communication. Automated Recursive Statistical Analysis (ARSA). Legacy System Correlation and Data Integrity.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide 6: Education & Community */}
            <div className="slide px-4 md:px-8 relative h-full">
                <div className="flex flex-col min-h-screen items-center select-none max-w-5xl mx-auto w-full pointer-events-auto overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl text-orange-400 mb-6 font-mono drop-shadow-[0_0_15px_rgba(249,115,22,0.8)] text-center sticky top-0 bg-black/50 py-4 backdrop-blur-md z-10 w-full uppercase">
                        EDUCATION & COMMUNITY
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full pb-10">
                        {/* Education */}
                        <div className="backdrop-blur-xl bg-black/60 border border-orange-500/30 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-4 border-b border-orange-500/20 pb-2">
                                <TerminalSquare className="w-8 h-8 text-orange-400" />
                                <h3 className="text-xl font-bold text-white">Education</h3>
                            </div>
                            <ul className="space-y-4 text-gray-300 font-mono text-sm list-none">
                                <li className="bg-orange-900/10 p-3 rounded-lg border border-orange-500/20">
                                    <strong className="text-orange-300 block text-base mb-1">Computer Science</strong>
                                    New Mexico State University<br/>
                                    <span className="text-xs text-gray-500">Las Cruces, NM</span>
                                </li>
                                <li className="bg-orange-900/10 p-3 rounded-lg border border-orange-500/20">
                                    <strong className="text-orange-300 block text-base mb-1">PLA Program</strong>
                                    CCA Aurora<br/>
                                    <span className="text-xs text-gray-400 block mt-1">Providing scientific journalism & ML/AI prototypes. Findings accredited and peer-reviewed in STEM Department.</span>
                                </li>
                            </ul>
                        </div>

                        {/* Extracurriculars */}
                        <div className="backdrop-blur-xl bg-black/60 border border-orange-500/30 p-6 rounded-2xl">
                            <div className="flex items-center gap-3 mb-4 border-b border-orange-500/20 pb-2">
                                <HeartHandshake className="w-8 h-8 text-orange-400" />
                                <h3 className="text-xl font-bold text-white">Volunteering</h3>
                            </div>
                            <div className="space-y-3 text-gray-300 font-mono text-sm pr-2">
                                <div><strong className="text-orange-300">Habitat for Humanity (Denver):</strong> Hands-on construction, affordable housing initiatives.</div>
                                <div><strong className="text-orange-300">Casa Latina (Seattle):</strong> Empowering low-wage immigrants, community mobilization.</div>
                                <div><strong className="text-orange-300">Volunteers of America (Denver):</strong> Essential support for socioeconomic disparities.</div>
                                <div><strong className="text-orange-300">Japanese Congressional Church:</strong> Sustainable housing, culturally sensitive approach.</div>
                                <div><strong className="text-orange-300">Byrd Barr Center:</strong> Equitable opportunities and housing policies.</div>
                                <div><strong className="text-orange-300">Seattle American Indian Center:</strong> Cultural events and socially tailored programs.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide 7: Research 1 */}
            <div className="slide px-4 md:px-8 relative h-full">
                <div className="flex flex-col min-h-screen items-center select-none max-w-5xl mx-auto w-full pointer-events-auto overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl text-purple-400 mb-6 font-mono drop-shadow-[0_0_15px_rgba(168,85,247,0.8)] text-center sticky top-0 bg-black/50 py-4 backdrop-blur-md z-10 w-full uppercase">
                        RESEARCH: PREDETERMINISM
                    </h2>
                    
                    <div className="backdrop-blur-xl bg-black/60 border border-purple-500/30 p-6 md:p-8 rounded-2xl shadow-lg w-full pb-10">
                        <div className="flex items-center gap-3 mb-4 border-b border-purple-500/20 pb-4">
                            <Lightbulb className="w-10 h-10 text-purple-400" />
                            <div>
                                <h3 className="text-xl md:text-xl md:text-2xl font-bold text-white leading-tight">Predeterminism in Non-Deterministic Systems Through Compound High-Dimensional ML Embeddings</h3>
                                <p className="text-purple-300 text-sm mt-1 font-mono">DOI: 10.29322/IJSRP.2891.283.2018.p383822</p>
                            </div>
                        </div>
                        
                        <div className="text-gray-300 font-mono text-sm leading-relaxed space-y-4">
                            <p>
                                <strong>Abstract:</strong> A novel computational paradigm mapping deterministic patterns within non-deterministic complex systems using nested, high-dimensional machine learning embeddings.
                            </p>
                            <p>
                                <strong>Geometric Lifting & Simplex Construction:</strong> Transformation of data through sequence of matrices. Density estimations define higher-dimensional constructs, capturing direction and scaled magnitude.
                            </p>
                            <p>
                                <strong>Identify & Resolve:</strong> Recursive calculation of n-dimensional matrix representations using inverse calculations of projectional trajectories. Machine learning models act as embedding functions, evolving parameters over iterations to achieve deterministic convergence.
                            </p>
                            <div className="bg-purple-900/10 border border-purple-500/20 p-4 rounded-lg mt-4 text-xs">
                                <em>"By embedding intelligence at multiple layers of data abstraction and enabling these layers to inform each other recursively, we construct a computational fabric that converges towards specific end-states."</em>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide 8: Research 2 */}
            <div className="slide px-4 md:px-8 relative h-full">
                <div className="flex flex-col min-h-screen items-center select-none max-w-5xl mx-auto w-full pointer-events-auto overflow-y-auto pt-20 pb-32">
                    <h2 className="text-3xl sm:text-4xl text-rose-400 mb-6 font-mono drop-shadow-[0_0_15px_rgba(244,63,94,0.8)] text-center sticky top-0 bg-black/50 py-4 backdrop-blur-md z-10 w-full uppercase">
                        RESEARCH: SCM FRAMEWORK
                    </h2>
                    
                    <div className="backdrop-blur-xl bg-black/60 border border-rose-500/30 p-6 md:p-8 rounded-2xl shadow-lg w-full pb-10">
                        <div className="flex items-center gap-3 mb-4 border-b border-rose-500/20 pb-4">
                            <Microscope className="w-10 h-10 text-rose-400" />
                            <div>
                                <h3 className="text-xl md:text-xl md:text-2xl font-bold text-white leading-tight">Structural Compute Mechanism (SCM)</h3>
                                <p className="text-rose-300 text-sm mt-1 font-mono">Kernel-Level Tensor Dissipation Framework (IEEE Conference)</p>
                            </div>
                        </div>
                        
                        <div className="text-gray-300 font-mono text-sm leading-relaxed space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <strong className="text-rose-400 block mb-2">Core Innovation</strong>
                                    <p>eBPF-based kernel application with Ahead-of-Time compilation eliminating middleware overhead for Clinical AI workflow data transformation.</p>
                                </div>
                                <div>
                                    <strong className="text-rose-400 block mb-2">Strategic Interception</strong>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Pre-tokenization user input capture</li>
                                        <li>Complete LLM response acquisition</li>
                                        <li>MoE neural network node activation</li>
                                    </ul>
                                </div>
                            </div>
                            
                            <hr className="border-rose-500/20 my-4" />
                            
                            <div>
                                <strong className="text-rose-400 block mb-2">Tensor Dissipation & K-Means</strong>
                                <p>Generates unique edge signatures ("geometric fingerprints") without explicit semantic analysis. Normalized edge values undergo k-means clustering to extract median values, revealing cross-domain convergence and optimization insights without RAG reference overhead.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
});
